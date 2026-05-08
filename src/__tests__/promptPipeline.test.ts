import { describe, expect, it } from 'vitest'
import {
  buildRoleplayPipeline,
  extractRoleplaySkillsFromPreset,
  makeUserConfigFileName,
} from '../promptPipeline'

const fixturePreset = {
  prompts: [
    {
      identifier: 'director-1',
      name: '🔒🖋️模块化剧情',
      enabled: true,
      role: 'user',
      content: '{{addvar::可待_创作准则::第一优先：〖模块化剧情创作指导〗 将此次输出的剧情内容分成三个剧情事件模块和一个结尾模块。}}',
    },
    {
      identifier: 'style-1',
      name: '🔒🖊️基础文风',
      enabled: true,
      role: 'user',
      content: '{{addvar::可待_文风准则::句式结构上长短句合理搭配。段落之间必须间隔一行。}}',
    },
    {
      identifier: 'unsafe-1',
      name: '💕总纲（NSFW必开）',
      enabled: true,
      role: 'user',
      content: 'SENSITIVE_SOURCE_TEXT',
    },
  ],
}

describe('extractRoleplaySkillsFromPreset', () => {
  it('extracts selected roleplay modules as skill records', () => {
    const skills = extractRoleplaySkillsFromPreset(fixturePreset)

    expect(skills.map(skill => skill.id)).toEqual([
      '🔒🖊️基础文风',
    ])
    expect(skills[0].layer).toBe('narrator')
    expect(skills[0].prompt).toContain('清爽小说文风')
  })

  it('does not export director abilities as skills', () => {
    const skills = extractRoleplaySkillsFromPreset(fixturePreset)

    expect(skills.some(skill => skill.id.startsWith('director.'))).toBe(false)
  })

  it('does not export fixed postprocess abilities as user config', () => {
    const skills = extractRoleplaySkillsFromPreset({
      prompts: [
        {
          identifier: 'logic',
          name: '😝逻辑加强',
          enabled: false,
          role: 'user',
          content: '第一优先：【逻辑加强】检查时间错乱、角色 OOC、角色全知。',
        },
        {
          identifier: 'options',
          name: '🔝细纲选项',
          enabled: false,
          role: 'user',
          content: '输出三个玩家选项。',
        },
      ],
    })

    expect(skills).toEqual([])
  })
})

describe('makeUserConfigFileName', () => {
  it('uses readable Chinese filenames', () => {
    expect(makeUserConfigFileName('🔒🖊️基础文风')).toBe('🔒🖊️基础文风.md')
  })
})

describe('buildRoleplayPipeline', () => {
  it('builds fixed director and narrator layers from selected skills', () => {
    const skills = extractRoleplaySkillsFromPreset(fixturePreset)
    const pipeline = buildRoleplayPipeline(skills, {
      worldState: '雨夜房间。NPC 隐瞒信件来源。',
      playerInput: '我看着她手里的信纸。',
      hardRules: '玩家输入优先。',
      globalContext: '旧信来源仍未揭示。',
      recentTurns: '上一轮林晚回避玩家视线。',
      loadedMaterialModules: 'character.lin-wan：林晚谨慎。',
      moduleRegistry: 'character.lin-wan：林晚人设。',
      directorPlan: '{"beats":[]}',
      directorPrompt: '固定导演 prompt：规划剧情模块、描写发展链和玩家窗口。',
      narratorPrompt: '固定叙事 prompt：按导演计划写正文草稿。',
    })

    expect(pipeline.map(layer => layer.layer)).toEqual(['director', 'narrator'])
    expect(pipeline[0].selectedModuleIds).toEqual([])
    expect(pipeline[0].user).toContain('【固定 Director prompt】')
    expect(pipeline[0].user).toContain('固定导演 prompt')
    expect(pipeline[0].user).toContain('【长期剧情总结】')
    expect(pipeline[0].user).toContain('【最近正文】')
    expect(pipeline[0].user).toContain('【可请求动态注入模块 registry】')
    expect(pipeline[0].user).not.toContain('可用导演 skills')
    expect(pipeline[1].user).toContain('【固定 Narrator prompt】')
    expect(pipeline[1].user).toContain('固定叙事 prompt')
    expect(pipeline[1].user).toContain('{"beats":[]}')
    expect(pipeline[1].selectedModuleIds).toContain('🔒🖊️基础文风')
    expect(pipeline[0].expectedOutput).toContain('"beats": "string[]"')
    expect(pipeline[0].expectedOutput).toContain('"sceneLimits": "string[]"')
  })

  it('keeps user modules out of director while injecting writing modules into narrator', () => {
    const skills = [
      {
        id: '🔒🖊️基础文风',
        name: '🔒🖊️基础文风',
        description: '基础文风配置。',
        layer: 'all' as const,
        sourceName: '基础文风',
        sourceIdentifier: null,
        sourceRole: null,
        enabledInSource: true,
        prompt: '正文采用清爽小说文风。',
      },
      {
        id: '抗缺陷',
        name: '抗缺陷',
        description: '质量控制配置。',
        layer: 'all' as const,
        sourceName: '抗缺陷',
        sourceIdentifier: null,
        sourceRole: null,
        enabledInSource: true,
        prompt: '检查最终正文，减少套话、重复和空泛表达。',
      },
    ]

    const pipeline = buildRoleplayPipeline(skills, {
      worldState: '茶馆。',
      playerInput: '我推门进去。',
      userInjectionModuleIds: ['🔒🖊️基础文风', '抗缺陷'],
    })

    expect(pipeline[0].userInjectionModuleIds).toEqual([])
    expect(pipeline[0].user).not.toContain('【用户注入模块】')
    expect(pipeline[0].user).not.toContain('正文采用清爽小说文风')
    expect(pipeline[0].user).not.toContain('检查最终正文')
    expect(pipeline[1].selectedModuleIds).toEqual([])
    expect(pipeline[1].userInjectionModuleIds).toEqual(['🔒🖊️基础文风', '抗缺陷'])
    expect(pipeline[1].user).toContain('【用户注入模块】')
    expect(pipeline[1].user).toContain('正文采用清爽小说文风')
    expect(pipeline[1].user.match(/## 🔒🖊️基础文风/g)).toHaveLength(1)
  })
})
