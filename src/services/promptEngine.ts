/**
 * System Prompt 变量替换引擎
 * 将模板中的 {{variable}} 替换为实际值
 */

const DEFAULT_VARIABLES: Record<string, string> = {
  selected_text: '',
  target_language: '中文',
  source_language: '英文',
}

/**
 * 编译 Prompt 模板
 * @param template 包含 {{variable}} 的模板字符串
 * @param variables 变量键值对
 * @param strict 严格模式：缺少变量时是否报错（默认 false，静默保留占位符）
 */
export function compilePrompt(
  template: string,
  variables: Record<string, string> = {},
  strict = false,
): { result: string; missingVars: string[] } {
  const merged = { ...DEFAULT_VARIABLES, ...variables }
  const missingVars: string[] = []

  const result = template.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
    if (varName in merged) {
      return merged[varName]
    }
    missingVars.push(varName)
    if (strict) {
      throw new Error(`缺少变量: ${varName}`)
    }
    // 非严格模式保留原占位符
    return `{{${varName}}}`
  })

  return { result, missingVars }
}

/**
 * 检查模板中引用的所有变量
 */
export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) || []
  return [...new Set(matches.map((m) => m.slice(2, -2)))]
}

/**
 * 预置动作的默认 Prompt 模板
 */
export const DEFAULT_PROMPTS = {
  translate: {
    zh2en:
      '你是一个专业的翻译助手。请将以下文字准确、流畅地翻译为英文，保持原意的同时让表达自然地道。\n\n{{selected_text}}',
    en2zh:
      '你是一个专业的翻译助手。请将以下文字准确、流畅地翻译为中文，保持原意的同时让表达自然地道。\n\n{{selected_text}}',
    auto:
      '你是一个专业的翻译助手。请将以下文字翻译，自动检测源语言并翻译为目标语言（{{target_language}}）。\n\n{{selected_text}}',
  },
  summarize: '你是一个擅长总结的助手。请用简洁的语言总结以下内容的核心要点，用 3-5 条要点呈现，每条不超过一句话。\n\n{{selected_text}}',
  explain: '你是一个善于解释复杂概念的老师。请用通俗易懂的语言、生活中的类比来解释以下内容，让没有任何背景知识的人也能轻松理解。\n\n{{selected_text}}',
  dictionary: '你是一个词典查询助手。请对「{{selected_text}}」给出：\n1) 音标\n2) 中文释义\n3) 词性\n4) 两个实用例句（中英对照）',
}
