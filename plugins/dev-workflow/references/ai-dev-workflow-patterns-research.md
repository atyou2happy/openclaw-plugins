# AI驱动开发工作流架构模式研究报告

基于 Aider、SWE-agent、OpenHands 三个顶级开源项目的深度源码分析


== 一、Aider (github.com/Aider-AI/aider) ==

=== 1. Token/上下文优化模式 ===

Repo Map 核心机制 (repomap.py):
Aider的核心创新是基于PageRank的代码库地图系统:

- Tree-sitter AST标签提取: get_tags()通过tree-sitter解析每个文件,提取Tag(rel_fname, fname, line, name, kind)命名元组。只提取def(定义)和ref(引用)两类标签

- PageRank图排序算法(get_ranked_tags):
  构建有向多边图MultiDiGraph,节点=文件,边=标识符引用关系
  权重计算关键技巧:
  * snake/camel且len>=8的标识符x10(有意义长命名更有价值)
  * 下划线开头标识符x0.1(私有/内部标识符价值低)
  * 定义数>5的标识符x0.1(高频通用标识符去噪)
  * chat文件中引用者x50(当前编辑文件引用的目标极其重要)
  * mentioned_idents中匹配的x10
  引用计数用sqrt(num_refs)平方根缩放防止高频低价值引用主导排序
  personalization参数使PageRank偏向当前工作上下文

- Token预算动态分配:
  默认map_tokens=1024,无chat文件时按map_mul_no_files=8倍放大
  max_context_window减4096 padding硬上限防溢出
  长文本(>200字符)采样估算token数:每100行取1行计算密度再乘总长度

- 多层缓存策略:
  map_cache内存缓存 / .aider.tags.cache.v4 SQLite持久化 / tree_cache解析结果缓存
  刷新策略:auto(处理时间>1秒才缓存)/manual/always/files

ChatChunks分块消息架构(base_coder.py):
- format_chat_chunks()将上下文分为7个独立块:system/examples/done/repo/readonly_files/chat_files/cur
- 每块独立计算token数,动态决定是否添加reminder prompt
- 缓存预热(warm_cache):利用Anthropic prompt caching,设置cache_control头部,5分钟keepalive

=== 2. 状态管理和检查点模式 ===

- 双消息队列:done_messages(历史完成消息)+cur_messages(当前对话消息)
- Git作为检查点:每次修改自动git commit,undo命令直接git reset --hard HEAD~1
- 异步摘要线程(summarize_start/worker/end):
  done_messages超限时后台线程启动LLM摘要
  threading.Thread异步执行不阻塞主交互
  完成后用摘要替换原始done_messages(需验证消息未在摘要期间改变)

=== 3. 错误恢复方法 ===

- Lint集成自修复:修改后自动运行linter,发现错误反馈给LLM自动修复
- Tree-sitter语法验证:返回LintResult(text,lines)给LLM参考修正
- 缓存故障降级:SQLite出错时重建缓存,最终降级为内存dict
- RecursionError恢复:仓库过大时捕获错误直接禁用repo map

=== 4. 减少LLM调用技巧 ===

- Prompt Caching主动利用:add_cache_headers()+warm_cache()利用缓存API
- Token采样估算:长文本不做全量tokenize
- choose_fence()自动选择fence字符避免冲突减少重试

== 二、SWE-agent (github.com/princeton-nlp/SWE-agent) ==

=== 1. Token/上下文优化模式 ===

History Processor链式架构(history_processors.py):
SWE-agent的核心是可组合的历史处理器管道:

- LastNObservations处理器:
  只保留最近N条observation(典型N=5)
  省略的替换为"Old environment output: (n lines omitted)"
  Polling优化:polling=1控制每N步才裁剪一次,避免每步改变历史导致prompt caching失效
  always_remove/keep_output_for_tags精细控制

- TagToolCallObservations:根据工具函数名为特定observation添加tag

- 观察截断模板(TemplateConfig):
  max_observation_length:100_000字符硬上限
  截断时指导LLM换用更短命令(head/tail/grep),形成自我调节循环

- Jinja2模板系统:所有消息模板化,便于针对性优化

=== 2. 状态管理和检查点模式 ===

DefaultAgent核心状态:
- history:消息历史(processor链处理后发给LLM)
- _trajectory:完整执行轨迹(不受processor影响,用于回放和评估)
- info:AgentInfo运行时统计

RetryAgent多尝试架构:
- 外层RetryAgent包装多个DefaultAgent,每次尝试独立
- _next_attempt()调用env.hard_reset()完全重置环境
- 尝试间预算传递:remaining_budget=cost_limit-total_stats
- 每步save_trajectory写入.traj JSON文件

RetryLoop评审机制:
- ScoreRetryLoop:提交后LLM评分决定是否重试
- ChooserRetryLoop:多尝试后LLM选择最佳方案

=== 3. 错误恢复方法 ===

多层错误处理体系(forward_with_handling):
- 格式错误重查询(max_requeries:3):输出无法解析时将错误附加到临时历史重新查询,错误不出现在正式history中(只在trajectory中)
- 被阻止动作恢复:should_block_action()检查黑名单命令
- Bash语法错误:shell_check_error_template反馈bash -n输出
- 命令超时处理(CommandTimeoutError):
  连续超时计数器_n_consecutive_timeouts
  interrupt_session()中断当前命令返回超时模板消息
- 自动提交兜底(attempt_autosubmission_after_error):
  即使agent崩溃也尝试git add -A提取当前修改
  runtime已死则从trajectory最后一步state["diff"]提取补丁
- 成本限制:CostLimitExceededError/TotalCostLimitExceededError双层保护

=== 4. 减少LLM调用技巧 ===

- Action Sampler(实验性):一次LLM调用生成多候选动作,评分选最优
- 演示压缩注入:put_demos_in_history=False时整个演示压缩为一条消息(省token)
- Cache Control管理:精确控制Anthropic prompt caching标记
- 空输出模板优化:next_step_no_output_template单独处理空输出避免模板渲染开销

== 三、OpenHands (github.com/All-Hands-AI/OpenHands) ==

=== 1. Token/上下文优化模式 ===

LLMSummarizingCondenser上下文压缩系统:
OpenHands V1的核心创新是可插拔的上下文压缩器架构:

- RollingCondenser滚动窗口基类:
  事件数超过max_size阈值时触发压缩
  keep_first参数保护初始系统提示和用户消息不被压缩
  始终保持最近消息完整

- LLMSummarizingCondenser:
  使用独立LLM实例(llm.model_copy)生成摘要
  摘要替换被裁剪的历史事件
  效果:每轮API成本降低2x,长会话响应时间一致,SWE任务性能等效或更好

- PipelineCondenser:支持链式组合多个压缩器(如先规则裁剪再LLM摘要)

- View抽象:将事件历史转换为LLM-ready视图,Condensation事件记录压缩元数据

=== 2. 状态管理和检查点模式 ===

V1核心原则:无状态+单一事实来源

- 所有组件不可变:Agent/Tool/LLM/配置均为immutable Pydantic model,构造时验证
- 唯一可变状态=ConversationState:
  EventLog:不可变追加写入(append-only)存储
  双路径更新:State-Only Updates(修改字段不追加事件)+Event-Based Updates(追加事件)

- Conversation工厂模式:
  LocalConversation:进程内直接执行
  RemoteConversation:HTTP/WebSocket委托agent-server
  切换只需更换workspace类型,代码不变

- 持久化和恢复:
  Pydantic序列化完整保存/恢复
  Pause/Resume(暂停执行不丢失状态)
  Fork(分支对话进行探索而不污染原始)

=== 3. 错误恢复方法 ===

- LLM Fallback Strategy:主模型失败自动尝试备用LLM
- Stuck Detector:检测agent死循环,超时机制自动终止
- Security Analyzer:动作执行前的安全分析验证
- Iterative Refinement:Critic模式评估agent动作质量,不达标则迭代改进

=== 4. 减少LLM调用技巧 ===

- Sub-Agent Delegation:任务委托给并行运行的子agent,结果合并返回,减少主agent迭代次数
- Parallel Tool Execution:单次LLM响应中并发执行多个独立工具调用
- Agent Skills and Context:结构化prompt注入领域知识减少agent需要探索的步数
- MCP集成:动态发现和使用外部工具避免在prompt中硬编码工具文档


== 四、对12步状态机工作流升级的架构启示 ==

Token/上下文优化建议:
1. PageRank代码地图(Aider) -> 大型代码库上下文选择
2. History Processor链(SWE-agent) -> 多级历史裁剪,保持prompt caching
3. LLM Summarizing Condenser(OpenHands) -> 长对话自动摘要
4. 观察截断+自调节提示(SWE-agent) -> 命令输出过长时的优雅降级
5. ChatChunks分块(Aider) -> 精确控制各部分的token预算

状态管理建议:
1. 双队列done+cur(Aider) -> 分离历史和当前对话
2. Trajectory vs History分离(SWE-agent) -> 完整记录vs LLM可见
3. Immutable State+EventLog(OpenHands) -> 确定性重放和调试
4. Git作为检查点(Aider) -> 代码修改的原子回滚
5. RetryAgent多尝试(SWE-agent) -> 成本受限的重试策略

错误恢复建议:
1. Requery不入history(SWE-agent) -> 格式/语法错误时隐形修正
2. 自动提交兜底(SWE-agent) -> 崩溃前的最后手段
3. LLM Fallback(OpenHands) -> 模型API不可用时的降级
4. Lint集成自修复(Aider) -> 代码质量保证的闭环
5. 成本双层保护(SWE-agent) -> 预算控制

减少LLM调用建议:
1. Prompt Caching主动利用(Aider) -> Anthropic/OpenAI缓存
2. Action Sampling(SWE-agent) -> 一次调用多候选动作评分
3. Parallel Tool Execution(OpenHands) -> 独立操作并发
4. 演示压缩注入(SWE-agent) -> Few-shot示例的token节省
5. Sub-Agent Delegation(OpenHands) -> 任务分解并行化

---
报告生成时间: 2026-05-07
数据来源: GitHub源码直接读取 + 官方文档
