import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Type, type Static } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";

const PROVIDERS = ["anthropic", "xai"] as const;
type Provider = (typeof PROVIDERS)[number];

const ENV_VAR_MAP: Record<Provider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  xai: "XAI_API_KEY",
};

const OPENAI_COMPATIBLE_ENV = "OPENAI_BASE_URL";

function getAuthDir(): string {
  return path.join(process.env.HOME || "~", ".openharness", "auth");
}

async function readOAuthToken(provider: Provider): Promise<Record<string, unknown> | null> {
  try {
    const filePath = path.join(getAuthDir(), `${provider}-oauth.json`);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function writeOAuthToken(provider: Provider, data: Record<string, unknown>): Promise<void> {
  const authDir = getAuthDir();
  await fs.mkdir(authDir, { recursive: true });
  const filePath = path.join(authDir, `${provider}-oauth.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function removeOAuthToken(provider: Provider): Promise<boolean> {
  try {
    const filePath = path.join(getAuthDir(), `${provider}-oauth.json`);
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

function generateCodeVerifier(): string {
  const bytes = crypto.randomBytes(32);
  return bytes.toString("base64url");
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  return hash.toString("base64url");
}

const AuthStatusInput = Type.Object({
  provider: Type.Optional(
    Type.Enum(
      { anthropic: "anthropic", xai: "xai", openai_compatible: "openai_compatible", all: "all" },
      { default: "all", description: "Provider to check status for" }
    )
  ),
});
type AuthStatusInputType = Static<typeof AuthStatusInput>;

function createAuthStatusTool() {
  return {
    name: "oh_auth_status",
    label: "Check Authentication Status",
    description: "Show authentication status for all providers or a specific provider",
    parameters: AuthStatusInput,
    async execute(_toolCallId: string, params: AuthStatusInputType) {
      const { provider = "all" } = params;
      const results: string[] = [];

      const providersToCheck = provider === "all" ? [...PROVIDERS, "openai_compatible" as const] : [provider];

      for (const p of providersToCheck) {
        if (p === "openai_compatible") {
          const hasEnv = !!process.env[OPENAI_COMPATIBLE_ENV];
          results.push(`openai_compatible: ${hasEnv ? "configured (OPENAI_BASE_URL set)" : "not configured"}`);
          continue;
        }

        const prov = p as Provider;
        const envVar = ENV_VAR_MAP[prov];
        const hasEnv = !!process.env[envVar];
        const oauthToken = await readOAuthToken(prov);
        const hasOauth = oauthToken !== null;

        let status: string;
        if (hasEnv) {
          status = `configured (${envVar} set)`;
        } else if (hasOauth) {
          status = "oauth (token stored)";
          const tokenData = oauthToken as Record<string, unknown>;
          if (tokenData.expires_at) {
            const expiresAt = new Date(tokenData.expires_at as string);
            const now = new Date();
            const isExpired = expiresAt < now;
            const timeLeft = isExpired ? "expired" : `${Math.round((expiresAt.getTime() - now.getTime()) / 60000)} minutes remaining`;
            status += `, expires: ${expiresAt.toISOString()} (${timeLeft})`;
          }
        } else {
          status = "not configured";
        }

        results.push(`${prov}: ${status}`);
      }

      return {
        content: [{ type: "text" as const, text: results.join("\n") }],
        details: { success: true },
      };
    },
  };
}

const AuthLoginInput = Type.Object({
  provider: Type.Enum(
    { anthropic: "anthropic", xai: "xai" },
    { description: "OAuth provider to authenticate with" }
  ),
  client_id: Type.Optional(Type.String({ description: "OAuth client ID" })),
  redirect_uri: Type.Optional(Type.String({ description: "OAuth redirect URI" })),
});
type AuthLoginInputType = Static<typeof AuthLoginInput>;

const OAUTH_ENDPOINTS: Record<Provider, string> = {
  anthropic: "https://console.anthropic.com/oauth/authorize",
  xai: "https://console.x.ai/oauth/authorize",
};

function createAuthLoginTool() {
  return {
    name: "oh_auth_login",
    label: "Initiate OAuth Login",
    description: "Initiate OAuth login for a provider using PKCE flow",
    parameters: AuthLoginInput,
    async execute(_toolCallId: string, params: AuthLoginInputType) {
      const { provider, client_id, redirect_uri } = params;
      const p = provider as Provider;

      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = crypto.randomBytes(16).toString("hex");

      const authState = {
        code_verifier: codeVerifier,
        code_challenge: codeChallenge,
        state,
        provider: p,
        created_at: new Date().toISOString(),
      };

      await writeOAuthToken(p, {
        ...authState,
        type: "pending_auth",
      });

      const endpoint = OAUTH_ENDPOINTS[p];
      const defaultClientId = provider === "anthropic" ? "openharness-client" : "openharness-xai-client";
      const defaultRedirectUri = "http://localhost:3000/auth/callback";

      const authUrl = new URL(endpoint);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", client_id || defaultClientId);
      authUrl.searchParams.set("redirect_uri", redirect_uri || defaultRedirectUri);
      authUrl.searchParams.set("code_challenge", codeChallenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("scope", "api_access");

      const instructions = [
        `OAuth Login Initiated for ${provider}`,
        "",
        `Visit the following URL to authorize:`,
        authUrl.toString(),
        "",
        `After authorization, you will be redirected to the callback URL with a code.`,
        `The code verifier has been stored for the token exchange step.`,
        "",
        `State: ${state}`,
      ];

      return {
        content: [{ type: "text" as const, text: instructions.join("\n") }],
        details: { success: true, authUrl: authUrl.toString(), state },
      };
    },
  };
}

const AuthLogoutInput = Type.Object({
  provider: Type.Enum(
    { anthropic: "anthropic", xai: "xai", all: "all" },
    { description: "Provider to revoke tokens for" }
  ),
});
type AuthLogoutInputType = Static<typeof AuthLogoutInput>;

function createAuthLogoutTool() {
  return {
    name: "oh_auth_logout",
    label: "Revoke OAuth Tokens",
    description: "Revoke OAuth tokens for a provider or all providers",
    parameters: AuthLogoutInput,
    async execute(_toolCallId: string, params: AuthLogoutInputType) {
      const { provider } = params;

      if (provider === "all") {
        const results: string[] = [];
        for (const p of PROVIDERS) {
          const removed = await removeOAuthToken(p);
          results.push(`${p}: ${removed ? "tokens revoked" : "no tokens found"}`);
        }
        return {
          content: [{ type: "text" as const, text: results.join("\n") }],
          details: { success: true },
        };
      }

      const removed = await removeOAuthToken(provider as Provider);
      const message = removed
        ? `OAuth tokens for ${provider} have been revoked.`
        : `No OAuth tokens found for ${provider}.`;

      return {
        content: [{ type: "text" as const, text: message }],
        details: { success: true },
      };
    },
  };
}

export function registerAuth(api: any) {
  api.registerTool(createAuthStatusTool());
  api.registerTool(createAuthLoginTool());
  api.registerTool(createAuthLogoutTool());
}
