#!/usr/bin/env node
import { Command } from 'commander'
import { schemas } from './vramework-schemas.js'
import { routes } from './vramework-routes.js'
import { nextjs } from './vramework-nextjs.js'
import { all } from './vramework-all.js'
import { types } from './vramework-types.js'

const program = new Command('vramework')
program.usage('[command]')

all(program)
routes(program)
types(program)
schemas(program)
nextjs(program)

program.parse(process.argv)
