### 模板A：Python 后端

```
<项目名>/
├── <项目名>/          # 源码包（config/ api/ services/ models/ utils/）
├── tests/             # 测试（conftest.py + unit/镜像源码 + integration/ + fixtures/）
├── scripts/           # 运维/工具脚本
├── openspec/
├── docs/
├── requirements.txt
├── setup.py / pyproject.toml
├── .gitignore
├── README.md
└── README_CN.md
```

### 模板B：Python 数据/CLI

```
<项目名>/
├── <项目名>/          # 源码（cli.py + core/ data/ utils/）
├── tests/             # 测试（unit/ integration/ fixtures/）
├── notebooks/         # Jupyter（如需要）
├── configs/           # YAML/JSON 配置
├── openspec/ docs/ requirements.txt README.md README_CN.md
```

### 模板C：前端/全栈

```
<项目名>/
├── <项目名>/
│   ├── frontend/      # 前端（src/components/ hooks/ services/ __tests__/ + package.json）
│   └── backend/       # 后端（app/ + requirements.txt）
├── tests/             # 后端测试（unit/ integration/）
├── openspec/ docs/ docker-compose.yml README.md README_CN.md
```

### 模板D：最小项目（Quick模式）

```
<项目名>/
├── <项目名>/          # （__init__.py + main.py）
├── tests/             # （test_main.py + conftest.py）
├── requirements.txt README.md README_CN.md
```

### 模板E：AI/大模型训练

```
<项目名>/
├── configs/                     # 配置集中（model/ train/ data/ eval/ 按规模分 yaml）
├── <项目名>/                    # 核心代码（models/ trainers/ data/ inference/ evaluation/ utils/）
├── scripts/                     # 运行脚本（train.sh eval.sh convert_checkpoint.py download_data.sh）
├── tests/                       # 测试（unit/ integration/ fixtures/tiny_model.yaml）
├── tools/                       # 开发辅助（profile.py visualize_attn.py compare_ckpt.py）
├── docs/ openspec/ requirements.txt setup.py/pyproject.toml .gitignore README.md README_CN.md
```

**大模型项目规则**：

| 规则 | 说明 |
|------|------|
| 权重不入 Git | `.gitignore` 排除 checkpoints/ outputs/ saved_models/ |
| 数据不入 Git | 排除 data/raw/，只保留 data/README.md 说明来源 |
| 配置和代码分离 | 所有超参放 configs/，不硬编码 |
| 多规模支持 | configs/model/ 下按规模分（small/base/large） |
| 测试用小模型 | tests/fixtures/tiny_model.yaml 定义最小可测配置 |
| 训练脚本独立 | scripts/ 放启动脚本，不跟代码混 |
| 分布式工具集中 | 放 utils/distributed.py |

---
