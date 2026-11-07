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
  R('arxiv-cs-cl', 'arXiv cs.CL 最新论文', 'paper', 'advanced', 'en', 'https://arxiv.org/list/cs.CL/recent', 'arXiv', '计算语言学最新论文流，跟踪前沿研究进展的第一现场。', ['论文', 'research', 'NLP']),
R('d2l-en', 'Dive into Deep Learning', 'book', 'beginner', 'en', 'https://d2l.ai/', 'Aston Zhang, Zachary Lipton, Mu Li, Alex Smola', '交互式深度学习教材，代码可运行，覆盖从基础到注意力机制。', ['deep-learning', 'PyTorch', 'book'], true, true),
R('stanford-cs224n', 'Stanford CS224N: NLP with Deep Learning', 'course', 'advanced', 'en', 'https://web.stanford.edu/class/cs224n/', 'Stanford University', '斯坦福 NLP 深度课程：词向量、Transformer 与大模型。', ['NLP', 'Transformers', 'LLM'], true),
R('deeplearning-ai-courses', 'DeepLearning.AI Short Courses', 'course', 'beginner', 'en', 'https://www.deeplearning.ai/short-courses/', 'DeepLearning.AI', '吴恩达团队的 LLM 短期实战课程合集。', ['LLM', 'Prompt', 'RAG'], true),
R('full-stack-deep-learning', 'Full Stack Deep Learning', 'course', 'intermediate', 'en', 'https://fullstackdeeplearning.com/', 'FSDL', '从原型到生产：ML 工程与部署全流程课程。', ['MLOps', 'deployment', 'production'], true),
R('huggingface-smol-course', 'Hugging Face Smol Course', 'course', 'intermediate', 'en', 'https://github.com/huggingface/smol-course', 'Hugging Face', 'Hugging Face 小模型训练与对齐实战课程。', ['LLM', 'fine-tuning', 'alignment'], true),
R('stanford-cs324', 'Stanford CS324: Large Language Models', 'course', 'advanced', 'en', 'https://stanford-cs324.github.io/winter2022/', 'Stanford University', '斯坦福大语言模型课程：能力、局限与社会影响。', ['LLM', 'research', 'ethics'], true),
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


/* English companions for the curated lists (used by the English edition). */
const RESOURCE_EN = {
  'awesome-llm-apps': { descriptionEn: 'Runnable collection of LLM apps (RAG/Agent/multimodal) for project inspiration.' },
  'huggingface-agents-course': { descriptionEn: 'Hands-on AI Agent course: tool use, reasoning frameworks and multi-agent systems.' },
  'huggingface-llm-course': { descriptionEn: 'Complete free path from Transformers basics to fine-tuning and deployment, with notebooks.' },
  'mcp-docs': { descriptionEn: 'Open MCP protocol docs: connect models to external tools and data; the base of agent tooling.' },
  'karpathy-zero-to-hero': { descriptionEn: 'From backprop from scratch to GPT: the best course for building intuition about LLMs.' },
  'datawhale-self-llm': { descriptionEn: 'Practical deployment and fine-tuning guide for Chinese open models (Qwen/GLM/InternLM).' },
  'd2l-zh': { descriptionEn: 'Classic Chinese deep-learning textbook with runnable code, from basics to attention.', authorEn: 'Mu Li et al.' },
  'ml-2024-hylee': { descriptionEn: 'Chinese introduction to ML and generative AI; lively lectures for beginners.', authorEn: 'Hung-yi Lee (NTU)' },
  'anthropic-prompt-eng': { descriptionEn: "Anthropic's official prompt-engineering docs: system prompts and tool-calling best practices." },
  'awesome-llm': { descriptionEn: 'Curated list of LLM papers and resources across pretraining, fine-tuning, evaluation and apps.' },
  'rasbt-llms-from-scratch': { descriptionEn: 'Build a GPT-like model step by step, with a book and code for the full training pipeline.' },
  'datawhale-llm-cookbook': { descriptionEn: "Chinese companion to Andrew Ng's LLM course: Prompt/RAG/fine-tuning/Agent.", authorEn: 'Datawhale + Andrew Ng' },
  'mlabonne-llm-course': { descriptionEn: 'Roadmap and Colab notebooks from basics to fine-tuning, quantization and deployment.' },
  'datawhale-llm-universe': { descriptionEn: 'Chinese hands-on course for application developers: API calls to RAG apps.' },
  'karpathy-llm101n': { descriptionEn: 'Build a storyteller LLM from scratch: training, fine-tuning and deployment.' },
  'lilianweng-blog': { descriptionEn: 'Technical blog by a former OpenAI researcher on agents, RAG and diffusion models.' },
  'openai-cookbook': { descriptionEn: 'Official examples: API usage, structured outputs, agents and evaluation best practices.' },
  'prompting-guide': { descriptionEn: 'The most systematic prompt-engineering guide, multilingual and continuously updated.' },
  'stanford-cs25': { descriptionEn: 'Stanford lecture series on Transformers with industry researchers on frontier models.' },
  'illustrated-transformer': { descriptionEn: 'Visual guide to Transformers and attention; a classic introduction.' },
  'arxiv-cs-cl': { descriptionEn: 'Latest computational-linguistics papers from arXiv; a frontline research feed.' },
  'd2l-en': { descriptionEn: 'Interactive deep learning book with runnable code, from basics to attention.' },
  'stanford-cs224n': { descriptionEn: 'Stanford NLP course: word vectors, Transformers and large language models.' },
  'deeplearning-ai-courses': { descriptionEn: "Short hands-on LLM courses from Andrew Ng's team." },
  'full-stack-deep-learning': { descriptionEn: 'From prototype to production: ML engineering and deployment.' },
  'huggingface-smol-course': { descriptionEn: 'Hugging Face course on training and aligning small language models.' },
  'stanford-cs324': { descriptionEn: 'Stanford course on large language models: capabilities, limits and societal impact.' },
  'internlm-tutorial': { descriptionEn: 'Chinese full-stack LLM bootcamp: deployment, fine-tuning, RAG, evaluation and agents.', authorEn: 'Shanghai AI Lab InternLM' },
};
const PROJECT_EN = {
  'ai-pulse': {
    nameEn: 'AI Pulse',
    summaryEn: 'This repo: a public, lightweight LLM tracker for updates, leaderboards and learning resources, with a BYOK assistant and project showcase.',
    highlightEn: 'Static site + GitHub Actions daily refresh',
    whyEn: 'A personal AI showcase: turn continuous tracking and a portfolio into a sustainable public product.',
  },
  ollama: {
    summaryEn: 'Run mainstream open models locally with one command; built-in model management and API.',
    highlightEn: 'The simplest way to run models locally',
    whyEn: 'A foundation for offline and privacy-first AI assistants.',
  },
  transformers: {
    summaryEn: 'Hugging Face model hub plus training/inference APIs across text, vision, audio and multimodal.',
    highlightEn: 'The backbone of the open-model ecosystem',
    whyEn: 'Understand model interfaces and ecosystem standards.',
  },
  dify: {
    summaryEn: 'Visual LLM app platform: workflows, agents, RAG and operations in one place.',
    highlightEn: 'Build production AI apps with low code',
    whyEn: 'A leading open-source reference for enterprise AI orchestration.',
  },
  'open-webui': {
    summaryEn: 'Self-hosted, feature-rich chat UI compatible with Ollama and OpenAI-compatible APIs.',
    highlightEn: 'One of the most active self-hosted LLM frontends',
    whyEn: 'A reference implementation for chat UIs and assistants.',
  },
  langchain: {
    summaryEn: 'Framework for LLM apps: chains, tools, agents and memory.',
    highlightEn: 'The de facto standard for LLM app frameworks',
    whyEn: 'Learn production engineering for agents and tool use.',
  },
  comfyui: {
    summaryEn: 'Node-based diffusion GUI and a powerful image/video generation workflow engine.',
    highlightEn: 'The benchmark for generative visual workflows',
    whyEn: 'Study multimodal generation and node orchestration.',
  },
  'browser-use': {
    summaryEn: 'Lets AI agents operate browsers to complete web tasks with visual and DOM interaction.',
    highlightEn: 'A leading browser-agent project',
    whyEn: 'Study agents interacting with real environments.',
  },
  vllm: {
    summaryEn: 'High-throughput, low-latency LLM inference and serving engine with PagedAttention.',
    highlightEn: 'A production standard for inference acceleration',
    whyEn: 'Study inference performance and deployment optimization.',
  },
  ragflow: {
    summaryEn: 'RAG engine built on deep document understanding, with complex PDF/table parsing and traceable answers.',
    highlightEn: 'Document understanding plus traceable citations',
    whyEn: 'A quality benchmark for RAG engineering.',
  },
  'mcp-servers': {
    summaryEn: 'Official MCP server collection connecting models to tools and data.',
    highlightEn: 'Standardizing the agent tool ecosystem',
    whyEn: 'Understand MCP and tool integration.',
  },
  'lobe-chat': {
    summaryEn: 'Modern high-performance open-source chat framework with multi-model, plugins and knowledge base.',
    highlightEn: 'A beautifully designed multi-model chat UI',
    whyEn: 'A reference for light-luxury visual and interaction design.',
  },
  crewai: {
    summaryEn: 'Multi-agent framework for roles, tasks, tools and workflow orchestration.',
    highlightEn: 'An approachable multi-agent framework',
    whyEn: 'Learn multi-agent collaboration patterns.',
  },
};
const RESOURCE_TITLE_EN = {
  'mcp-docs': "Model Context Protocol Docs",
  'datawhale-self-llm': "Self-LLM: Open LLM Guide",
  'd2l-zh': "Dive into Deep Learning (D2L)",
  'ml-2024-hylee': "Hung-yi Lee Machine Learning Course",
  'datawhale-llm-cookbook': "LLM Cookbook for Developers",
  'datawhale-llm-universe': "LLM Universe: App Development",
  'internlm-tutorial': "InternLM LLM Bootcamp",
  'arxiv-cs-cl': "arXiv cs.CL Latest Papers",
};
for (const item of RESOURCES) if (RESOURCE_TITLE_EN[item.id]) item.titleEn = RESOURCE_TITLE_EN[item.id];
for (const item of RESOURCES) Object.assign(item, RESOURCE_EN[item.id] || {});
for (const item of PROJECTS) Object.assign(item, PROJECT_EN[item.id] || {});

/** Spot-check resource links (used by --check-links): HEAD/GET probes only; records status without mutating data */
export const LINK_PROBE_SKIP = new Set(['huggingface.co', 'www.anthropic.com']);
