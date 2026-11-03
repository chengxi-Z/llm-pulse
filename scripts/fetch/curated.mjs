/**
 * curated.mjs — hand-curated list of learning resources and projects (real and long-lived;
 * links are spot-checked by --check-links). At least 15 resources (22 in practice) and at
 * least 6 projects (13 in practice); bilingual with difficulty levels.
 * Project stars/license/updatedAt are refreshed through the GitHub API; the stars field is
 * only a fallback holding the last real value when the API is unavailable.
 */
const ADDED_AT = '2026-11-03T00:00:00.000Z';

const R = (id, title, type, level, lang, url, author, description, tags, free = true, featured = false) => ({
  id, title, type, level, lang, url, author, description, tags, free, featured, addedAt: ADDED_AT,
});

export const RESOURCES = [
  R('huggingface-llm-course', 'Hugging Face LLM Course', 'course', 'beginner', 'en', 'https://huggingface.co/learn/llm-course', 'Hugging Face', '从 Transformer 基础到微调、部署的完整免费课程，含 Notebook 实战。', ['LLM', 'Transformers', 'fine-tuning'], true, true),
  R('huggingface-agents-course', 'Hugging Face Agents Course', 'course', 'intermediate', 'en', 'https://huggingface.co/learn/agents-course', 'Hugging Face', '系统学习 AI Agent：工具调用、推理框架与多智能体，含实战项目。', ['Agent', 'tool-use', 'LLM'], true, true),
  R('karpathy-zero-to-hero', 'Neural Networks: Zero to Hero', 'course', 'beginner', 'en', 'https://karpathy.ai/zero-to-hero.html', 'Andrej Karpathy', '从反向传播手写实现到 GPT，最适合建立大模型底层直觉的课程。', ['from-scratch', 'GPT', 'PyTorch'], true, true),
  R('karpathy-llm101n', 'LLM101n: Let’s build a Storyteller', 'course', 'advanced', 'en', 'https://github.com/karpathy/LLM101n', 'Andrej Karpathy', '从零构建一个讲故事的大语言模型，覆盖训练/微调/部署全链路。', ['from-scratch', 'LLM', 'education']),
  R('stanford-cs25', 'Stanford CS25: Transformers United', 'course', 'intermediate', 'en', 'https://web.stanford.edu/class/cs25/', 'Stanford University', 'Transformer 前沿讲座合集，邀请业界研究员讲最新模型与方向。', ['Transformer', 'research', 'lectures']),
  R('d2l-zh', '动手学深度学习（D2L）', 'book', 'beginner', 'zh', 'https://zh.d2l.ai/', '李沐 等', '中文深度学习经典教材，代码可运行，覆盖基础到注意力机制。', ['深度学习', 'PyTorch', '中文'], true, true),
  R('ml-2024-hylee', '李宏毅机器学习课程', 'course', 'beginner', 'zh', 'https://speech.ee.ntu.edu.tw/~hylee/ml/2023-spring.php', '李宏毅 (NTU)', '中文机器学习/生成式 AI 入门课，讲解生动，适合零基础入门。', ['机器学习', '生成式AI', '中文'], true, true),
  R('datawhale-self-llm', 'Self-LLM 开源大模型食用指南', 'tutorial', 'intermediate', 'zh', 'https://github.com/datawhalechina/self-llm', 'Datawhale', '面向国内开源大模型的部署、微调实战教程（Qwen/GLM/InternLM 等）。', ['微调', '开源模型', '中文'], true, true),
  R('datawhale-llm-universe', 'LLM Universe 大模型应用开发', 'tutorial', 'beginner', 'zh', 'https://github.com/datawhalechina/llm-universe', 'Datawhale', '从 API 调用到 RAG 应用开发的中文实战课程，面向应用开发者。', ['RAG', '应用开发', '中文']),
  R('datawhale-llm-cookbook', 'LLM Cookbook 面向开发者的大模型手册', 'tutorial', 'intermediate', 'zh', 'https://github.com/datawhalechina/llm-cookbook', 'Datawhale + 吴恩达', '吴恩达课程的中文精读版，覆盖 Prompt/RAG/微调/Agent。', ['Prompt', 'RAG', '中文']),
  R('prompting-guide', 'Prompt Engineering Guide', 'tutorial', 'beginner', 'multi', 'https://www.promptingguide.ai/', 'DAIR.AI', '最系统的提示工程指南，多语言（含中文），持续更新。', ['Prompt', 'LLM', 'guide']),
  R('openai-cookbook', 'OpenAI Cookbook', 'tutorial', 'intermediate', 'en', 'https://cookbook.openai.com/', 'OpenAI', '官方示例集：API 用法、结构化输出、Agent、评测最佳实践。', ['API', 'examples', 'OpenAI']),
  R('anthropic-prompt-eng', 'Anthropic Prompt Engineering', 'tutorial', 'intermediate', 'en', 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview', 'Anthropic', 'Claude 官方提示工程文档，含系统提示、工具调用最佳实践。', ['Prompt', 'Claude', 'API']),
  R('mlabonne-llm-course', 'LLM Course by Maxime Labonne', 'course', 'intermediate', 'en', 'https://github.com/mlabonne/llm-course', 'Maxime Labonne', '含路线图与 Colab Notebook：从基础到微调、量化、部署的实践路线。', ['fine-tuning', 'quantization', 'roadmap']),
  R('rasbt-llms-from-scratch', 'Build an LLM from Scratch', 'book', 'advanced', 'en', 'https://github.com/rasbt/LLMs-from-scratch', 'Sebastian Raschka', '逐步手写实现类 GPT 模型，配套书籍与代码，理解训练全流程。', ['from-scratch', 'GPT', 'book']),
  R('illustrated-transformer', 'The Illustrated Transformer', 'tutorial', 'beginner', 'en', 'https://jalammar.github.io/illustrated-transformer/', 'Jay Alammar', '用可视化图解 Transformer 与注意力机制，经典入门读物。', ['Transformer', 'visualization', '入门']),
  R('awesome-llm', 'Awesome-LLM', 'awesome', 'beginner', 'en', 'https://github.com/Hannibal046/Awesome-LLM', 'Hannibal046', '大模型论文与资源精选列表，涵盖预训练、微调、评测、应用。', ['awesome', 'papers', 'LLM']),
  R('awesome-llm-apps', 'Awesome LLM Apps', 'awesome', 'intermediate', 'en', 'https://github.com/Shubhamsaboo/awesome-llm-apps', 'Shubham Saboo', '可直接运行的 LLM 应用合集（RAG/Agent/多模态），适合找项目灵感。', ['apps', 'RAG', 'Agent'], true, true),
  R('lilianweng-blog', 'Lilian Weng Blog', 'paper', 'advanced', 'en', 'https://lilianweng.github.io/', 'Lilian Weng', '前 OpenAI 研究员的技术博客，系统讲解 Agent、RAG、扩散模型等。', ['Agent', 'RAG', '深度长文']),
  R('mcp-docs', 'Model Context Protocol 文档', 'tool', 'intermediate', 'en', 'https://modelcontextprotocol.io/', 'Anthropic / MCP', 'MCP 开放协议：让模型安全连接外部工具与数据，Agent 工具生态基础。', ['MCP', 'Agent', 'protocol'], true, true),
  R('internlm-tutorial', '书生大模型实战营', 'tutorial', 'intermediate', 'zh', 'https://github.com/InternLM/Tutorial', '上海AI实验室 InternLM', '中文大模型全栈实战：部署、微调、RAG、评测与智能体。', ['实战营', 'InternLM', '中文']),
  R('arxiv-cs-cl', 'arXiv cs.CL 最新论文', 'paper', 'advanced', 'en', 'https://arxiv.org/list/cs.CL/recent', 'arXiv', '计算语言学最新论文流，跟踪前沿研究进展的第一现场。', ['论文', 'research', 'NLP']),
];

const P = (id, name, owner, repo, summary, tags, highlight, sourceType, license, why, stars = null) => ({
  id, name, owner, repo, summary, tags, highlight, sourceType, license, why, stars,
  url: repo ? `https://github.com/${repo}` : null,
});

export const PROJECTS = [
  P('ai-pulse', 'AI Pulse · 照胆云', 'chengxi-Z', 'chengxi-Z/llm-pulse', '本仓库：公域轻量级大模型追踪站，聚合动态/排行/学习资源，内置 BYOK AI 助手与项目展示。', ['static-site', 'llm-tracking', 'github-pages'], '纯静态 + GitHub Actions 每日自动刷新', 'self', 'MIT', '个人 AI 项目成果展示位：把「持续跟踪 + 个人作品集」做成可持续运营的公域产品。', null),
  P('ollama', 'Ollama', 'ollama', 'ollama/ollama', '一条命令在本地运行主流开源大模型，内置模型管理与 API。', ['local-llm', 'inference', 'cli'], '本地跑模型的最简方式', 'community', 'MIT', '离线/隐私场景的 AI 助手底座。', 185768),
  P('transformers', 'Transformers', 'huggingface', 'huggingface/transformers', 'Hugging Face 模型库与训练/推理 API，覆盖文本、视觉、音频、多模态。', ['models', 'inference', 'hub'], '开源模型生态的基石', 'community', 'Apache-2.0', '理解模型接口与生态标准。', 168487),
  P('dify', 'Dify', 'langgenius', 'langgenius/dify', '可视化 LLM 应用开发平台：工作流、Agent、RAG 与运营一体化。', ['LLMOps', 'workflow', 'RAG'], '低代码构建生产级 AI 应用', 'community', null, '企业级 AI 应用编排的最佳开源参考。', 160316),
  P('open-webui', 'Open WebUI', 'open-webui', 'open-webui/open-webui', '自托管、功能丰富的大模型 Web 交互界面，兼容 Ollama 与 OpenAI 兼容 API。', ['chat-ui', 'self-hosted', 'ollama'], '社区最活跃的自托管 LLM 前端之一', 'community', null, '适合作为 AI 助手与聊天 UI 的参考实现。', 157636),
  P('langchain', 'LangChain', 'langchain-ai', 'langchain-ai/langchain', '构建 LLM 应用的开发框架，覆盖链式调用、工具、Agent、记忆。', ['framework', 'agents', 'ecosystem'], 'LLM 应用框架的事实标准', 'community', 'MIT', '学习 Agent/工具调用工程化。', 148937),
  P('comfyui', 'ComfyUI', 'Comfy-Org', 'comfyanonymous/ComfyUI', '节点式扩散模型图形界面，强大的图像/视频生成工作流引擎。', ['image-gen', 'workflow', 'diffusion'], '生成式视觉工作流标杆', 'community', 'GPL-3.0', '研究多模态生成与节点编排。', 144787),
  P('browser-use', 'Browser Use', 'browser-use', 'browser-use/browser-use', '让 AI Agent 直接操作浏览器完成网页任务，支持视觉与 DOM 交互。', ['agent', 'browser', 'automation'], '浏览器 Agent 代表项目', 'community', 'MIT', '研究 Agent 与真实环境交互。', 119914),
  P('vllm', 'vLLM', 'vllm-project', 'vllm-project/vllm', '高吞吐、低延迟的 LLM 推理与服务引擎，PagedAttention 等优化。', ['inference', 'serving', 'performance'], '生产级推理加速标配', 'community', 'Apache-2.0', '研究推理性能与部署优化。', 96207),
  P('ragflow', 'RAGFlow', 'infiniflow', 'infiniflow/ragflow', '基于深度文档理解的 RAG 引擎，支持复杂 PDF/表格解析与可溯源问答。', ['RAG', 'document-ai', 'retrieval'], '文档理解 + 可溯源引用', 'community', 'Apache-2.0', '研究 RAG 工程质量标杆。', 93423),
  P('mcp-servers', 'MCP Servers', 'modelcontextprotocol', 'modelcontextprotocol/servers', 'Model Context Protocol 官方服务器集合，为模型接入工具与数据。', ['MCP', 'protocol', 'tools'], 'Agent 工具生态标准化', 'community', null, '理解 MCP 生态与工具接入。', 91764),
  P('lobe-chat', 'LobeChat', 'lobehub', 'lobehub/lobe-chat', '现代设计的高性能开源聊天框架，支持多模型、插件与知识库。', ['chat-ui', 'design', 'plugins'], '设计出色的多模型聊天界面', 'community', null, '轻奢视觉与交互设计的参考。', 83764),
  P('crewai', 'CrewAI', 'crewAIInc', 'crewAIInc/crewAI', '多智能体协作框架：角色、任务、工具与流程编排。', ['agents', 'multi-agent', 'orchestration'], '多智能体协作的易用框架', 'community', 'MIT', '学习多 Agent 协作范式。', 60444),
];

/** Spot-check resource links (used by --check-links): HEAD/GET probes only; records status without mutating data */
export const LINK_PROBE_SKIP = new Set(['huggingface.co', 'www.anthropic.com']);
