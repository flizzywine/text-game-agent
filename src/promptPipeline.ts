import fs from 'fs'
import path from 'path'

export type RoleplayLayer = 'director' | 'narrator' | 'editor' | 'postprocess' | 'all'

export interface SourcePromptModule {
  identifier?: string
  name?: string
  enabled?: boolean
  role?: string
  content?: string
}

export interface RoleplaySkill {
  id: string
  name: string
  description: string
  layer: RoleplayLayer
  sourceName: string
  sourceIdentifier: string | null
  sourceRole: string | null
  enabledInSource: boolean
  prompt: string
}

export interface RoleplayPipelineInput {
  worldState: string
  playerInput: string
  draftText?: string
  hardRules?: string
  globalContext?: string
  recentTurns?: string
  loadedMaterialModules?: string
  loadedMaterialSkills?: string
  moduleRegistry?: string
  skillRegistry?: string
  directorPlan?: string
  userInjectionModuleIds?: string[]
  directSkillIds?: string[]
  directorPrompt?: string
  narratorPrompt?: string
  editorPrompt?: string
}

export interface RoleplayLayerPrompt {
  layer: 'director' | 'narrator' | 'editor'
  selectedModuleIds: string[]
  userInjectionModuleIds: string[]
  system: string
  user: string
  expectedOutput: string
}

interface SkillDefinition {
  id: string
  matchNames: string[]
  layer: RoleplayLayer
  description: string
  fallbackPrompt?: string
  fallbackPromptFile?: string
}

const SKILL_DEFINITIONS: SkillDefinition[] = [
  {
    id: '🔒🖊️基础文风',
    matchNames: ['🔒🖊️基础文风'],
    layer: 'narrator',
    description: '提供基础文风、段落、对话和描写要求。',
    fallbackPrompt: '正文采用清爽小说文风：段落清楚，长短句合理搭配；对话、动作、神态、环境和潜台词交替出现；避免对白墙、空泛抒情和提示词痕迹。',
  },
]


function getPromptModules(preset: unknown): SourcePromptModule[] {
  if (!preset || typeof preset !== 'object') return []
  const root = preset as { prompts?: unknown; oai_settings?: { prompts?: unknown } }
  const prompts = Array.isArray(root.prompts)
    ? root.prompts
    : Array.isArray(root.oai_settings?.prompts)
      ? root.oai_settings.prompts
      : []
  return prompts.filter((item): item is SourcePromptModule => Boolean(item && typeof item === 'object'))
}

function stripAddvarNoise(content: string): string {
  return content
    .replace(/\{\{\/\/[\s\S]*?\}\}/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
}

function readRequiredPrompt(relativePath: string): string {
  const prompt = readOptionalPrompt(relativePath)
  if (!prompt) throw new Error(`missing prompt file: ${relativePath}`)
  return prompt
}

function readOptionalPrompt(relativePath: string | undefined): string | undefined {
  if (!relativePath) return undefined
  const filePath = path.normalize(path.join(process.cwd(), relativePath))
  if (!isInsidePath(process.cwd(), filePath) || !fs.existsSync(filePath)) return undefined
  const content = fs.readFileSync(filePath, 'utf-8').trim()
  const marker = '\n---\n'
  const index = content.indexOf(marker)
  return (index >= 0 ? content.slice(index + marker.length) : content).trim()
}

function isInsidePath(parent: string, child: string): boolean {
  const relative = path.relative(parent, child)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function makeUserConfigFileName(id: string): string {
  return `${id.replace(/[\/\0]/g, '_').replace(/:/g, '：').trim() || '未命名配置'}.md`
}

export function extractRoleplaySkillsFromPreset(preset: unknown): RoleplaySkill[] {
  const modules = getPromptModules(preset)
  const skills: RoleplaySkill[] = []
  const usedIds = new Set<string>()

  for (const definition of SKILL_DEFINITIONS) {
    const source = definition.matchNames
      .map(name => modules.find(module => module.name === name))
      .find((module): module is SourcePromptModule => Boolean(module))
    if (!source) continue

    const rawContent = source.content ?? ''
    const prompt = definition.fallbackPrompt
      ?? (definition.fallbackPromptFile ? readRequiredPrompt(definition.fallbackPromptFile) : stripAddvarNoise(rawContent))

    if (usedIds.has(definition.id)) continue
    usedIds.add(definition.id)
    skills.push({
      id: definition.id,
      name: source.name ?? definition.id,
      description: definition.description,
      layer: definition.layer,
      sourceName: source.name ?? '',
      sourceIdentifier: source.identifier ?? null,
      sourceRole: source.role ?? null,
      enabledInSource: source.enabled === true,
      prompt,
    })
  }

  return skills
}

function skillBlock(skill: RoleplaySkill): string {
  return [
    `## ${skill.id}`,
    `名称：${skill.name}`,
    `说明：${skill.description}`,
    skill.prompt,
  ].filter(Boolean).join('\n')
}

function skillsForLayerExcludingIds(
  skills: RoleplaySkill[],
  layer: RoleplayLayer,
  excludedSkillIds: string[] = [],
): RoleplaySkill[] {
  const excluded = new Set(excludedSkillIds)
  return skills.filter(skill => skill.layer === layer && !excluded.has(skill.id))
}

function directSkillsForLayer(
  skills: RoleplaySkill[],
  _layer: RoleplayLayer,
  directSkillIds: string[] = [],
): RoleplaySkill[] {
  const idSet = new Set(directSkillIds)
  return skills.filter(skill => idSet.has(skill.id))
}

function directSkillBlock(skills: RoleplaySkill[]): string {
  if (skills.length === 0) return ''
  return [
    '【用户注入模块】',
    skills.map(skillBlock).join('\n\n'),
    '',
  ].join('\n')
}

function sectionBlock(label: string, content: string | undefined, fallback = '（无）'): string[] {
  const value = content?.trim() || fallback
  return [`【${label}】`, value, '']
}

const DEFAULT_DIRECTOR_PROMPT = readRequiredPrompt('prompts/director/prompt.md')
const DEFAULT_NARRATOR_PROMPT = readRequiredPrompt('prompts/narrator/prompt.md')
const DEFAULT_EDITOR_PROMPT = readRequiredPrompt('prompts/editor/prompt.md')
const MUST_READ_TOP = readRequiredPrompt('prompts/system-hard-rules/must-read-top.md')
const MUST_READ_BOTTOM = readRequiredPrompt('prompts/system-hard-rules/must-read-bottom.md')

function wrapWithMustRead(content: string): string {
  return [MUST_READ_TOP, content.trim(), MUST_READ_BOTTOM].join('\n\n')
}

export function buildRoleplayPipeline(
  skills: RoleplaySkill[],
  input: RoleplayPipelineInput,
): RoleplayLayerPrompt[] {
  const directSkillIds = input.userInjectionModuleIds ?? input.directSkillIds ?? []
  const narratorSkills = skillsForLayerExcludingIds(skills, 'narrator', directSkillIds)
  const editorSkills = skillsForLayerExcludingIds(skills, 'editor', directSkillIds)
  const directDirectorSkills = directSkillsForLayer(skills, 'director', directSkillIds)
  const directNarratorSkills = directSkillsForLayer(skills, 'narrator', directSkillIds)
  const directEditorSkills = directSkillsForLayer(skills, 'editor', directSkillIds)
  const draftText = input.draftText ?? '（正文草稿将在叙事层生成后填入）'
  const directorPlan = input.directorPlan ?? '（此处填入 director JSON）'
  const directorPrompt = input.directorPrompt?.trim() || DEFAULT_DIRECTOR_PROMPT
  const narratorPrompt = input.narratorPrompt?.trim() || DEFAULT_NARRATOR_PROMPT
  const editorPrompt = input.editorPrompt?.trim() || DEFAULT_EDITOR_PROMPT
  const loadedMaterialModules = input.loadedMaterialModules ?? input.loadedMaterialSkills
  const moduleRegistry = input.moduleRegistry ?? input.skillRegistry

  return [
    {
      layer: 'director',
      selectedModuleIds: [],
      userInjectionModuleIds: directDirectorSkills.map(skill => skill.id),
      system: '',
      user: wrapWithMustRead([
        '【固定 Director prompt】',
        directorPrompt,
        '',
        ...sectionBlock('硬规则', input.hardRules),
        ...sectionBlock('当前世界状态', input.worldState),
        ...sectionBlock('长期剧情总结', input.globalContext),
        ...sectionBlock('最近正文', input.recentTurns),
        ...sectionBlock('当前玩家输入', input.playerInput),
        ...sectionBlock('已加载动态注入模块', loadedMaterialModules),
        directSkillBlock(directDirectorSkills),
        ...sectionBlock('可请求动态注入模块 registry', moduleRegistry, '当前 MVP 暂未加载动态注入模块 registry。后续只允许请求人物、世界、地点、剧情素材模块，不允许请求 director.* 能力模块。'),
      ].join('\n')),
      expectedOutput: 'JSON: { "preflight": "object", "novelGuidance": "object", "loadModuleIds": "string[]", "sceneBeats": "SceneBeat[]", "descriptionPlans": "DescriptionPlan[]", "mustNotResolve": "string[]", "exitWindow": "string" }',
    },
    {
      layer: 'narrator',
      selectedModuleIds: narratorSkills.map(skill => skill.id),
      userInjectionModuleIds: directNarratorSkills.map(skill => skill.id),
      system: '',
      user: wrapWithMustRead([
        '【固定 Narrator prompt】',
        narratorPrompt,
        '',
        ...sectionBlock('硬规则', input.hardRules),
        ...sectionBlock('导演计划', directorPlan),
        ...sectionBlock('当前世界状态', input.worldState),
        ...sectionBlock('长期剧情总结', input.globalContext),
        ...sectionBlock('最近正文', input.recentTurns),
        ...sectionBlock('当前玩家输入', input.playerInput),
        ...sectionBlock('已加载动态注入模块', loadedMaterialModules),
        directSkillBlock(directNarratorSkills),
        '【叙事配置模块】',
        narratorSkills.map(skillBlock).join('\n\n') || '（无）',
      ].join('\n')),
      expectedOutput: 'JSON: { "draftParagraphs": "{ id: string, text: string }[]", "draftText": "兼容用正文草稿", "draftChecks": "string[]", "handoffNotes": "string[]" }',
    },
    {
      layer: 'editor',
      selectedModuleIds: editorSkills.map(skill => skill.id),
      userInjectionModuleIds: directEditorSkills.map(skill => skill.id),
      system: '',
      user: wrapWithMustRead([
        '【固定 Editor prompt】',
        editorPrompt,
        '',
        ...sectionBlock('硬规则', input.hardRules),
        ...sectionBlock('当前世界状态', input.worldState),
        ...sectionBlock('长期剧情总结', input.globalContext),
        ...sectionBlock('最近正文', input.recentTurns),
        ...sectionBlock('已加载动态注入模块', loadedMaterialModules),
        ...sectionBlock('导演计划', directorPlan),
        ...sectionBlock('正文草稿', draftText),
        ...sectionBlock('当前玩家输入', input.playerInput),
        directSkillBlock(directEditorSkills),
        '【审核配置模块】',
        editorSkills.map(skillBlock).join('\n\n') || '（无）',
      ].join('\n')),
      expectedOutput: 'JSON: { "finalText": "修订后的正文", "qualityAssessment": "object", "issuesFixed": "string[]", "nextTurnGuidance": "string[]" }',
    },
  ]
}

function yamlValue(value: unknown): string {
  return JSON.stringify(String(value ?? '').replace(/\r?\n/g, ' ').trim())
}

export function writeRoleplayUserConfigFiles(skills: RoleplaySkill[], outDir: string): void {
  fs.mkdirSync(outDir, { recursive: true })
  for (const skill of skills) {
    const filePath = path.join(outDir, makeUserConfigFileName(skill.id))
    fs.writeFileSync(filePath, [
      '---',
      `id: ${yamlValue(skill.id)}`,
      `name: ${yamlValue(skill.name || skill.id)}`,
      `description: ${yamlValue(skill.description)}`,
      `group: ${yamlValue('文风')}`,
      `enabled: ${skill.enabledInSource ? 'true' : 'false'}`,
      '---',
      '',
      skill.prompt.trim(),
      '',
    ].join('\n'))
  }
}
