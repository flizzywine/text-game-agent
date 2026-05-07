import fs from 'fs'
import path from 'path'
import {
  extractRoleplaySkillsFromPreset,
  writeRoleplayUserConfigFiles,
} from '../src/promptPipeline'

const DEFAULT_SOURCE = '/Users/cf/Downloads/5.5【可待-创】 一幕三场.json'
const DEFAULT_OUT_DIR = path.resolve(process.cwd(), 'prompts/user-config')

const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SOURCE
const outDir = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_OUT_DIR

const raw = fs.readFileSync(sourcePath, 'utf-8')
const preset = JSON.parse(raw) as unknown
const skills = extractRoleplaySkillsFromPreset(preset)

fs.mkdirSync(outDir, { recursive: true })
writeRoleplayUserConfigFiles(skills, outDir)

console.log(`imported ${skills.length} user config items`)
console.log(outDir)
