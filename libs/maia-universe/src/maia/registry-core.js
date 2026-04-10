/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-maia-universe-registry.mjs
 */

import { annotateMaiaConfig } from '@MaiaOS/factories/annotate-maia'

import raw0 from '@MaiaOS/universe/actors/os/ai/actor.maia'
import raw1 from '@MaiaOS/universe/actors/os/ai/interface.maia'
import raw2 from '@MaiaOS/universe/actors/os/ai/process.maia'
import raw3 from '@MaiaOS/universe/actors/os/db/actor.maia'
import raw4 from '@MaiaOS/universe/actors/os/db/interface.maia'
import raw5 from '@MaiaOS/universe/actors/os/db/process.maia'
import raw6 from '@MaiaOS/universe/actors/os/messages/actor.maia'
import raw7 from '@MaiaOS/universe/actors/os/messages/context.maia'
import raw8 from '@MaiaOS/universe/actors/os/messages/interface.maia'
import raw9 from '@MaiaOS/universe/actors/os/messages/process.maia'
import raw10 from '@MaiaOS/universe/actors/services/names/actor.maia'
import raw11 from '@MaiaOS/universe/actors/services/names/interface.maia'
import raw12 from '@MaiaOS/universe/actors/services/names/process.maia'
import raw13 from '@MaiaOS/universe/actors/services/paper/actor.maia'
import raw14 from '@MaiaOS/universe/actors/services/paper/context.maia'
import raw15 from '@MaiaOS/universe/actors/services/paper/interface.maia'
import raw16 from '@MaiaOS/universe/actors/services/paper/process.maia'
import raw17 from '@MaiaOS/universe/actors/services/profile-image/actor.maia'
import raw18 from '@MaiaOS/universe/actors/services/profile-image/interface.maia'
import raw19 from '@MaiaOS/universe/actors/services/profile-image/process.maia'
import raw20 from '@MaiaOS/universe/actors/services/sandboxed-add/actor.maia'
import raw21 from '@MaiaOS/universe/actors/services/sandboxed-add/interface.maia'
import raw22 from '@MaiaOS/universe/actors/services/sandboxed-add/process.maia'
import raw23 from '@MaiaOS/universe/actors/services/sandboxed-add/wasm.maia'
import raw24 from '@MaiaOS/universe/actors/services/spark/actor.maia'
import raw25 from '@MaiaOS/universe/actors/services/spark/context.maia'
import raw26 from '@MaiaOS/universe/actors/services/spark/interface.maia'
import raw27 from '@MaiaOS/universe/actors/services/spark/process.maia'
import raw28 from '@MaiaOS/universe/actors/services/todos/actor.maia'
import raw29 from '@MaiaOS/universe/actors/services/todos/context.maia'
import raw30 from '@MaiaOS/universe/actors/services/todos/interface.maia'
import raw31 from '@MaiaOS/universe/actors/services/todos/process.maia'
import raw32 from '@MaiaOS/universe/actors/services/update-wasm-code/actor.maia'
import raw33 from '@MaiaOS/universe/actors/services/update-wasm-code/inbox.maia'
import raw34 from '@MaiaOS/universe/actors/services/update-wasm-code/interface.maia'
import raw35 from '@MaiaOS/universe/actors/services/update-wasm-code/process.maia'
import raw36 from '@MaiaOS/universe/actors/views/addressbook-avens-grid/actor.maia'
import raw37 from '@MaiaOS/universe/actors/views/addressbook-avens-grid/context.maia'
import raw38 from '@MaiaOS/universe/actors/views/addressbook-avens-grid/inbox.maia'
import raw39 from '@MaiaOS/universe/actors/views/addressbook-avens-grid/interface.maia'
import raw40 from '@MaiaOS/universe/actors/views/addressbook-grid/process.maia'
import raw41 from '@MaiaOS/universe/actors/views/addressbook-grid/style.maia'
import raw42 from '@MaiaOS/universe/actors/views/addressbook-grid/view.maia'
import raw43 from '@MaiaOS/universe/actors/views/addressbook-humans-grid/actor.maia'
import raw44 from '@MaiaOS/universe/actors/views/addressbook-humans-grid/context.maia'
import raw45 from '@MaiaOS/universe/actors/views/addressbook-humans-grid/inbox.maia'
import raw46 from '@MaiaOS/universe/actors/views/addressbook-humans-grid/interface.maia'
import raw47 from '@MaiaOS/universe/actors/views/detail/actor.maia'
import raw48 from '@MaiaOS/universe/actors/views/detail/context.maia'
import raw49 from '@MaiaOS/universe/actors/views/detail/interface.maia'
import raw50 from '@MaiaOS/universe/actors/views/detail/process.maia'
import raw51 from '@MaiaOS/universe/actors/views/detail/style.maia'
import raw52 from '@MaiaOS/universe/actors/views/detail/view.maia'
import raw53 from '@MaiaOS/universe/actors/views/humans/actor.maia'
import raw54 from '@MaiaOS/universe/actors/views/humans/context.maia'
import raw55 from '@MaiaOS/universe/actors/views/humans/interface.maia'
import raw56 from '@MaiaOS/universe/actors/views/info-card/actor.maia'
import raw57 from '@MaiaOS/universe/actors/views/info-card/context.maia'
import raw58 from '@MaiaOS/universe/actors/views/info-card/interface.maia'
import raw59 from '@MaiaOS/universe/actors/views/info-card/process.maia'
import raw60 from '@MaiaOS/universe/actors/views/info-card/style.maia'
import raw61 from '@MaiaOS/universe/actors/views/info-card/view.maia'
import raw62 from '@MaiaOS/universe/actors/views/input/for-chat.actor.maia'
import raw63 from '@MaiaOS/universe/actors/views/input/for-chat.context.maia'
import raw64 from '@MaiaOS/universe/actors/views/input/for-chat.interface.maia'
import raw65 from '@MaiaOS/universe/actors/views/input/for-chat.process.maia'
import raw66 from '@MaiaOS/universe/actors/views/input/for-detail.actor.maia'
import raw67 from '@MaiaOS/universe/actors/views/input/for-detail.context.maia'
import raw68 from '@MaiaOS/universe/actors/views/input/for-detail.interface.maia'
import raw69 from '@MaiaOS/universe/actors/views/input/for-list.actor.maia'
import raw70 from '@MaiaOS/universe/actors/views/input/for-list.context.maia'
import raw71 from '@MaiaOS/universe/actors/views/input/for-list.interface.maia'
import raw72 from '@MaiaOS/universe/actors/views/input/for-list.process.maia'
import raw73 from '@MaiaOS/universe/actors/views/input/for-sparks.actor.maia'
import raw74 from '@MaiaOS/universe/actors/views/input/for-sparks.context.maia'
import raw75 from '@MaiaOS/universe/actors/views/input/for-sparks.interface.maia'
import raw76 from '@MaiaOS/universe/actors/views/input/inbox.maia'
import raw77 from '@MaiaOS/universe/actors/views/input/process.maia'
import raw78 from '@MaiaOS/universe/actors/views/input/style.maia'
import raw79 from '@MaiaOS/universe/actors/views/input/view.maia'
import raw80 from '@MaiaOS/universe/actors/views/layout-chat/actor.maia'
import raw81 from '@MaiaOS/universe/actors/views/layout-chat/context.maia'
import raw82 from '@MaiaOS/universe/actors/views/layout-chat/interface.maia'
import raw83 from '@MaiaOS/universe/actors/views/layout-chat/process.maia'
import raw84 from '@MaiaOS/universe/actors/views/layout-chat/view.maia'
import raw85 from '@MaiaOS/universe/actors/views/layout-paper/actor.maia'
import raw86 from '@MaiaOS/universe/actors/views/layout-paper/context.maia'
import raw87 from '@MaiaOS/universe/actors/views/layout-paper/interface.maia'
import raw88 from '@MaiaOS/universe/actors/views/layout-paper/process.maia'
import raw89 from '@MaiaOS/universe/actors/views/layout-paper/style.maia'
import raw90 from '@MaiaOS/universe/actors/views/layout-paper/view.maia'
import raw92 from '@MaiaOS/universe/actors/views/list/actor.maia'
import raw93 from '@MaiaOS/universe/actors/views/list/context.maia'
import raw94 from '@MaiaOS/universe/actors/views/list/interface.maia'
import raw95 from '@MaiaOS/universe/actors/views/list/process.maia'
import raw96 from '@MaiaOS/universe/actors/views/list/style.maia'
import raw97 from '@MaiaOS/universe/actors/views/list/view.maia'
import raw91 from '@MaiaOS/universe/actors/views/list-detail/style.maia'
import raw98 from '@MaiaOS/universe/actors/views/logs/actor.maia'
import raw99 from '@MaiaOS/universe/actors/views/logs/context.maia'
import raw100 from '@MaiaOS/universe/actors/views/logs/interface.maia'
import raw101 from '@MaiaOS/universe/actors/views/logs/process.maia'
import raw102 from '@MaiaOS/universe/actors/views/logs/style.maia'
import raw103 from '@MaiaOS/universe/actors/views/logs/view.maia'
import raw104 from '@MaiaOS/universe/actors/views/messages/actor.maia'
import raw105 from '@MaiaOS/universe/actors/views/messages/context.maia'
import raw106 from '@MaiaOS/universe/actors/views/messages/interface.maia'
import raw107 from '@MaiaOS/universe/actors/views/messages/process.maia'
import raw108 from '@MaiaOS/universe/actors/views/messages/style.maia'
import raw109 from '@MaiaOS/universe/actors/views/messages/view.maia'
import raw110 from '@MaiaOS/universe/actors/views/paper/actor.maia'
import raw111 from '@MaiaOS/universe/actors/views/paper/context.maia'
import raw112 from '@MaiaOS/universe/actors/views/paper/interface.maia'
import raw113 from '@MaiaOS/universe/actors/views/paper/process.maia'
import raw114 from '@MaiaOS/universe/actors/views/paper/style.maia'
import raw115 from '@MaiaOS/universe/actors/views/paper/view.maia'
import raw116 from '@MaiaOS/universe/actors/views/placeholder/actor.maia'
import raw117 from '@MaiaOS/universe/actors/views/placeholder/context.maia'
import raw118 from '@MaiaOS/universe/actors/views/placeholder/interface.maia'
import raw119 from '@MaiaOS/universe/actors/views/placeholder/process.maia'
import raw120 from '@MaiaOS/universe/actors/views/placeholder/style.maia'
import raw121 from '@MaiaOS/universe/actors/views/placeholder/view.maia'
import raw122 from '@MaiaOS/universe/actors/views/profile-image/actor.maia'
import raw123 from '@MaiaOS/universe/actors/views/profile-image/context.maia'
import raw124 from '@MaiaOS/universe/actors/views/profile-image/interface.maia'
import raw125 from '@MaiaOS/universe/actors/views/profile-image/process.maia'
import raw126 from '@MaiaOS/universe/actors/views/profile-image/style.maia'
import raw127 from '@MaiaOS/universe/actors/views/profile-image/view.maia'
import raw128 from '@MaiaOS/universe/actors/views/sparks/actor.maia'
import raw129 from '@MaiaOS/universe/actors/views/sparks/context.maia'
import raw130 from '@MaiaOS/universe/actors/views/sparks/interface.maia'
import raw131 from '@MaiaOS/universe/actors/views/sparks/process.maia'
import raw132 from '@MaiaOS/universe/actors/views/sparks/style.maia'
import raw133 from '@MaiaOS/universe/actors/views/sparks/view.maia'
import raw134 from '@MaiaOS/universe/actors/views/tabs/inbox.maia'
import raw135 from '@MaiaOS/universe/actors/views/tabs/process.maia'
import raw136 from '@MaiaOS/universe/actors/views/tabs/style.maia'
import raw137 from '@MaiaOS/universe/actors/views/tabs/todos.actor.maia'
import raw138 from '@MaiaOS/universe/actors/views/tabs/todos.context.maia'
import raw139 from '@MaiaOS/universe/actors/views/tabs/todos.interface.maia'
import raw140 from '@MaiaOS/universe/actors/views/tabs/view.maia'
import raw141 from '@MaiaOS/universe/factories/actor.factory.maia'
import raw142 from '@MaiaOS/universe/factories/aven-identity.factory.maia'
import raw143 from '@MaiaOS/universe/factories/avens-identity-registry.factory.maia'
import raw144 from '@MaiaOS/universe/factories/capability.factory.maia'
import raw145 from '@MaiaOS/universe/factories/chat.factory.maia'
import raw146 from '@MaiaOS/universe/factories/co-types.defs.maia'
import raw147 from '@MaiaOS/universe/factories/cobinary.factory.maia'
import raw148 from '@MaiaOS/universe/factories/context.factory.maia'
import raw149 from '@MaiaOS/universe/factories/cotext.factory.maia'
import raw150 from '@MaiaOS/universe/factories/event.factory.maia'
import raw151 from '@MaiaOS/universe/factories/factories-registry.factory.maia'
import raw152 from '@MaiaOS/universe/factories/groups.factory.maia'
import raw153 from '@MaiaOS/universe/factories/human.factory.maia'
import raw154 from '@MaiaOS/universe/factories/humans-registry.factory.maia'
import raw155 from '@MaiaOS/universe/factories/inbox.factory.maia'
import raw156 from '@MaiaOS/universe/factories/indexes-registry.factory.maia'
import raw157 from '@MaiaOS/universe/factories/maia-script-expression.factory.maia'
import raw158 from '@MaiaOS/universe/factories/meta.factory.maia'
import raw159 from '@MaiaOS/universe/factories/notes.factory.maia'
import raw160 from '@MaiaOS/universe/factories/os-registry.factory.maia'
import raw161 from '@MaiaOS/universe/factories/process.factory.maia'
import raw162 from '@MaiaOS/universe/factories/profile.factory.maia'
import raw163 from '@MaiaOS/universe/factories/registries.factory.maia'
import raw164 from '@MaiaOS/universe/factories/spark.factory.maia'
import raw165 from '@MaiaOS/universe/factories/sparks-registry.factory.maia'
import raw166 from '@MaiaOS/universe/factories/style.factory.maia'
import raw167 from '@MaiaOS/universe/factories/todos.factory.maia'
import raw168 from '@MaiaOS/universe/factories/vibe.factory.maia'
import raw169 from '@MaiaOS/universe/factories/vibes-registry.factory.maia'
import raw170 from '@MaiaOS/universe/factories/view.factory.maia'
import raw171 from '@MaiaOS/universe/factories/wasm.factory.maia'
import raw172 from '@MaiaOS/universe/vibes/brand/maiacity.style.maia'
import raw173 from '@MaiaOS/universe/vibes/chat/intent/intent.actor.maia'
import raw174 from '@MaiaOS/universe/vibes/chat/intent/intent.context.maia'
import raw175 from '@MaiaOS/universe/vibes/chat/intent/intent.process.maia'
import raw176 from '@MaiaOS/universe/vibes/chat/intent/intent.view.maia'
import raw177 from '@MaiaOS/universe/vibes/chat/manifest.vibe.maia'
import raw178 from '@MaiaOS/universe/vibes/humans/intent/intent.actor.maia'
import raw179 from '@MaiaOS/universe/vibes/humans/intent/intent.context.maia'
import raw180 from '@MaiaOS/universe/vibes/humans/intent/intent.process.maia'
import raw181 from '@MaiaOS/universe/vibes/humans/intent/intent.view.maia'
import raw182 from '@MaiaOS/universe/vibes/humans/manifest.vibe.maia'
import raw183 from '@MaiaOS/universe/vibes/logs/intent/intent.actor.maia'
import raw184 from '@MaiaOS/universe/vibes/logs/intent/intent.context.maia'
import raw185 from '@MaiaOS/universe/vibes/logs/intent/intent.process.maia'
import raw186 from '@MaiaOS/universe/vibes/logs/intent/intent.view.maia'
import raw187 from '@MaiaOS/universe/vibes/logs/manifest.vibe.maia'
import raw188 from '@MaiaOS/universe/vibes/paper/manifest.vibe.maia'
import raw189 from '@MaiaOS/universe/vibes/profile/intent/intent.actor.maia'
import raw190 from '@MaiaOS/universe/vibes/profile/intent/intent.context.maia'
import raw191 from '@MaiaOS/universe/vibes/profile/intent/intent.process.maia'
import raw192 from '@MaiaOS/universe/vibes/profile/intent/intent.view.maia'
import raw193 from '@MaiaOS/universe/vibes/profile/manifest.vibe.maia'
import raw194 from '@MaiaOS/universe/vibes/quickjs/add-form/actor.maia'
import raw195 from '@MaiaOS/universe/vibes/quickjs/add-form/context.maia'
import raw196 from '@MaiaOS/universe/vibes/quickjs/add-form/interface.maia'
import raw197 from '@MaiaOS/universe/vibes/quickjs/add-form/process.maia'
import raw198 from '@MaiaOS/universe/vibes/quickjs/add-form/view.maia'
import raw204 from '@MaiaOS/universe/vibes/quickjs/deps-list/actor.maia'
import raw205 from '@MaiaOS/universe/vibes/quickjs/deps-list/interface.maia'
import raw206 from '@MaiaOS/universe/vibes/quickjs/deps-list/process.maia'
import raw207 from '@MaiaOS/universe/vibes/quickjs/deps-list/style.maia'
import raw208 from '@MaiaOS/universe/vibes/quickjs/deps-list/view.maia'
import raw199 from '@MaiaOS/universe/vibes/quickjs/deps-list-detail/actor.maia'
import raw200 from '@MaiaOS/universe/vibes/quickjs/deps-list-detail/context.maia'
import raw201 from '@MaiaOS/universe/vibes/quickjs/deps-list-detail/interface.maia'
import raw202 from '@MaiaOS/universe/vibes/quickjs/deps-list-detail/process.maia'
import raw203 from '@MaiaOS/universe/vibes/quickjs/deps-list-detail/view.maia'
import raw209 from '@MaiaOS/universe/vibes/quickjs/intent/intent.actor.maia'
import raw210 from '@MaiaOS/universe/vibes/quickjs/intent/intent.context.maia'
import raw211 from '@MaiaOS/universe/vibes/quickjs/intent/intent.process.maia'
import raw212 from '@MaiaOS/universe/vibes/quickjs/intent/intent.view.maia'
import raw213 from '@MaiaOS/universe/vibes/quickjs/layout-quickjs/actor.maia'
import raw214 from '@MaiaOS/universe/vibes/quickjs/layout-quickjs/context.maia'
import raw215 from '@MaiaOS/universe/vibes/quickjs/layout-quickjs/interface.maia'
import raw216 from '@MaiaOS/universe/vibes/quickjs/manifest.vibe.maia'
import raw217 from '@MaiaOS/universe/vibes/sparks/intent/intent.actor.maia'
import raw218 from '@MaiaOS/universe/vibes/sparks/intent/intent.context.maia'
import raw219 from '@MaiaOS/universe/vibes/sparks/intent/intent.process.maia'
import raw220 from '@MaiaOS/universe/vibes/sparks/intent/intent.view.maia'
import raw221 from '@MaiaOS/universe/vibes/sparks/manifest.vibe.maia'
import raw222 from '@MaiaOS/universe/vibes/todos/intent/intent.actor.maia'
import raw223 from '@MaiaOS/universe/vibes/todos/intent/intent.context.maia'
import raw224 from '@MaiaOS/universe/vibes/todos/intent/intent.process.maia'
import raw225 from '@MaiaOS/universe/vibes/todos/intent/intent.view.maia'
import raw226 from '@MaiaOS/universe/vibes/todos/manifest.vibe.maia'
import raw227 from './data/icons.data.maia'
import raw228 from './data/notes.data.maia'
import raw229 from './data/todos.data.maia'

const _actorPairs = [
	['os/ai/actor.maia', raw0],
	['os/ai/interface.maia', raw1],
	['os/ai/process.maia', raw2],
	['os/db/actor.maia', raw3],
	['os/db/interface.maia', raw4],
	['os/db/process.maia', raw5],
	['os/messages/actor.maia', raw6],
	['os/messages/context.maia', raw7],
	['os/messages/interface.maia', raw8],
	['os/messages/process.maia', raw9],
	['services/names/actor.maia', raw10],
	['services/names/interface.maia', raw11],
	['services/names/process.maia', raw12],
	['services/paper/actor.maia', raw13],
	['services/paper/context.maia', raw14],
	['services/paper/interface.maia', raw15],
	['services/paper/process.maia', raw16],
	['services/profile-image/actor.maia', raw17],
	['services/profile-image/interface.maia', raw18],
	['services/profile-image/process.maia', raw19],
	['services/sandboxed-add/actor.maia', raw20],
	['services/sandboxed-add/interface.maia', raw21],
	['services/sandboxed-add/process.maia', raw22],
	['services/sandboxed-add/wasm.maia', raw23],
	['services/spark/actor.maia', raw24],
	['services/spark/context.maia', raw25],
	['services/spark/interface.maia', raw26],
	['services/spark/process.maia', raw27],
	['services/todos/actor.maia', raw28],
	['services/todos/context.maia', raw29],
	['services/todos/interface.maia', raw30],
	['services/todos/process.maia', raw31],
	['services/update-wasm-code/actor.maia', raw32],
	['services/update-wasm-code/inbox.maia', raw33],
	['services/update-wasm-code/interface.maia', raw34],
	['services/update-wasm-code/process.maia', raw35],
	['views/addressbook-avens-grid/actor.maia', raw36],
	['views/addressbook-avens-grid/context.maia', raw37],
	['views/addressbook-avens-grid/inbox.maia', raw38],
	['views/addressbook-avens-grid/interface.maia', raw39],
	['views/addressbook-grid/process.maia', raw40],
	['views/addressbook-grid/style.maia', raw41],
	['views/addressbook-grid/view.maia', raw42],
	['views/addressbook-humans-grid/actor.maia', raw43],
	['views/addressbook-humans-grid/context.maia', raw44],
	['views/addressbook-humans-grid/inbox.maia', raw45],
	['views/addressbook-humans-grid/interface.maia', raw46],
	['views/detail/actor.maia', raw47],
	['views/detail/context.maia', raw48],
	['views/detail/interface.maia', raw49],
	['views/detail/process.maia', raw50],
	['views/detail/style.maia', raw51],
	['views/detail/view.maia', raw52],
	['views/humans/actor.maia', raw53],
	['views/humans/context.maia', raw54],
	['views/humans/interface.maia', raw55],
	['views/info-card/actor.maia', raw56],
	['views/info-card/context.maia', raw57],
	['views/info-card/interface.maia', raw58],
	['views/info-card/process.maia', raw59],
	['views/info-card/style.maia', raw60],
	['views/info-card/view.maia', raw61],
	['views/input/for-chat.actor.maia', raw62],
	['views/input/for-chat.context.maia', raw63],
	['views/input/for-chat.interface.maia', raw64],
	['views/input/for-chat.process.maia', raw65],
	['views/input/for-detail.actor.maia', raw66],
	['views/input/for-detail.context.maia', raw67],
	['views/input/for-detail.interface.maia', raw68],
	['views/input/for-list.actor.maia', raw69],
	['views/input/for-list.context.maia', raw70],
	['views/input/for-list.interface.maia', raw71],
	['views/input/for-list.process.maia', raw72],
	['views/input/for-sparks.actor.maia', raw73],
	['views/input/for-sparks.context.maia', raw74],
	['views/input/for-sparks.interface.maia', raw75],
	['views/input/inbox.maia', raw76],
	['views/input/process.maia', raw77],
	['views/input/style.maia', raw78],
	['views/input/view.maia', raw79],
	['views/layout-chat/actor.maia', raw80],
	['views/layout-chat/context.maia', raw81],
	['views/layout-chat/interface.maia', raw82],
	['views/layout-chat/process.maia', raw83],
	['views/layout-chat/view.maia', raw84],
	['views/layout-paper/actor.maia', raw85],
	['views/layout-paper/context.maia', raw86],
	['views/layout-paper/interface.maia', raw87],
	['views/layout-paper/process.maia', raw88],
	['views/layout-paper/style.maia', raw89],
	['views/layout-paper/view.maia', raw90],
	['views/list-detail/style.maia', raw91],
	['views/list/actor.maia', raw92],
	['views/list/context.maia', raw93],
	['views/list/interface.maia', raw94],
	['views/list/process.maia', raw95],
	['views/list/style.maia', raw96],
	['views/list/view.maia', raw97],
	['views/logs/actor.maia', raw98],
	['views/logs/context.maia', raw99],
	['views/logs/interface.maia', raw100],
	['views/logs/process.maia', raw101],
	['views/logs/style.maia', raw102],
	['views/logs/view.maia', raw103],
	['views/messages/actor.maia', raw104],
	['views/messages/context.maia', raw105],
	['views/messages/interface.maia', raw106],
	['views/messages/process.maia', raw107],
	['views/messages/style.maia', raw108],
	['views/messages/view.maia', raw109],
	['views/paper/actor.maia', raw110],
	['views/paper/context.maia', raw111],
	['views/paper/interface.maia', raw112],
	['views/paper/process.maia', raw113],
	['views/paper/style.maia', raw114],
	['views/paper/view.maia', raw115],
	['views/placeholder/actor.maia', raw116],
	['views/placeholder/context.maia', raw117],
	['views/placeholder/interface.maia', raw118],
	['views/placeholder/process.maia', raw119],
	['views/placeholder/style.maia', raw120],
	['views/placeholder/view.maia', raw121],
	['views/profile-image/actor.maia', raw122],
	['views/profile-image/context.maia', raw123],
	['views/profile-image/interface.maia', raw124],
	['views/profile-image/process.maia', raw125],
	['views/profile-image/style.maia', raw126],
	['views/profile-image/view.maia', raw127],
	['views/sparks/actor.maia', raw128],
	['views/sparks/context.maia', raw129],
	['views/sparks/interface.maia', raw130],
	['views/sparks/process.maia', raw131],
	['views/sparks/style.maia', raw132],
	['views/sparks/view.maia', raw133],
	['views/tabs/inbox.maia', raw134],
	['views/tabs/process.maia', raw135],
	['views/tabs/style.maia', raw136],
	['views/tabs/todos.actor.maia', raw137],
	['views/tabs/todos.context.maia', raw138],
	['views/tabs/todos.interface.maia', raw139],
	['views/tabs/view.maia', raw140],
]
export const annotateMaiaByActorsPath = Object.fromEntries(
	_actorPairs.map(([rel, raw]) => [rel, annotateMaiaConfig(raw, rel)]),
)

const _factoryPairs = [
	['actor.factory.maia', raw141],
	['aven-identity.factory.maia', raw142],
	['avens-identity-registry.factory.maia', raw143],
	['capability.factory.maia', raw144],
	['chat.factory.maia', raw145],
	['co-types.defs.maia', raw146],
	['cobinary.factory.maia', raw147],
	['context.factory.maia', raw148],
	['cotext.factory.maia', raw149],
	['event.factory.maia', raw150],
	['factories-registry.factory.maia', raw151],
	['groups.factory.maia', raw152],
	['human.factory.maia', raw153],
	['humans-registry.factory.maia', raw154],
	['inbox.factory.maia', raw155],
	['indexes-registry.factory.maia', raw156],
	['maia-script-expression.factory.maia', raw157],
	['meta.factory.maia', raw158],
	['notes.factory.maia', raw159],
	['os-registry.factory.maia', raw160],
	['process.factory.maia', raw161],
	['profile.factory.maia', raw162],
	['registries.factory.maia', raw163],
	['spark.factory.maia', raw164],
	['sparks-registry.factory.maia', raw165],
	['style.factory.maia', raw166],
	['todos.factory.maia', raw167],
	['vibe.factory.maia', raw168],
	['vibes-registry.factory.maia', raw169],
	['view.factory.maia', raw170],
	['wasm.factory.maia', raw171],
]
export const annotateMaiaByFactoriesPath = Object.fromEntries(
	_factoryPairs.map(([rel, raw]) => [rel, annotateMaiaConfig(raw, rel)]),
)

const _vibeMaiaPairs = [
	['brand/maiacity.style.maia', raw172],
	['chat/intent/intent.actor.maia', raw173],
	['chat/intent/intent.context.maia', raw174],
	['chat/intent/intent.process.maia', raw175],
	['chat/intent/intent.view.maia', raw176],
	['chat/manifest.vibe.maia', raw177],
	['humans/intent/intent.actor.maia', raw178],
	['humans/intent/intent.context.maia', raw179],
	['humans/intent/intent.process.maia', raw180],
	['humans/intent/intent.view.maia', raw181],
	['humans/manifest.vibe.maia', raw182],
	['logs/intent/intent.actor.maia', raw183],
	['logs/intent/intent.context.maia', raw184],
	['logs/intent/intent.process.maia', raw185],
	['logs/intent/intent.view.maia', raw186],
	['logs/manifest.vibe.maia', raw187],
	['paper/manifest.vibe.maia', raw188],
	['profile/intent/intent.actor.maia', raw189],
	['profile/intent/intent.context.maia', raw190],
	['profile/intent/intent.process.maia', raw191],
	['profile/intent/intent.view.maia', raw192],
	['profile/manifest.vibe.maia', raw193],
	['quickjs/add-form/actor.maia', raw194],
	['quickjs/add-form/context.maia', raw195],
	['quickjs/add-form/interface.maia', raw196],
	['quickjs/add-form/process.maia', raw197],
	['quickjs/add-form/view.maia', raw198],
	['quickjs/deps-list-detail/actor.maia', raw199],
	['quickjs/deps-list-detail/context.maia', raw200],
	['quickjs/deps-list-detail/interface.maia', raw201],
	['quickjs/deps-list-detail/process.maia', raw202],
	['quickjs/deps-list-detail/view.maia', raw203],
	['quickjs/deps-list/actor.maia', raw204],
	['quickjs/deps-list/interface.maia', raw205],
	['quickjs/deps-list/process.maia', raw206],
	['quickjs/deps-list/style.maia', raw207],
	['quickjs/deps-list/view.maia', raw208],
	['quickjs/intent/intent.actor.maia', raw209],
	['quickjs/intent/intent.context.maia', raw210],
	['quickjs/intent/intent.process.maia', raw211],
	['quickjs/intent/intent.view.maia', raw212],
	['quickjs/layout-quickjs/actor.maia', raw213],
	['quickjs/layout-quickjs/context.maia', raw214],
	['quickjs/layout-quickjs/interface.maia', raw215],
	['quickjs/manifest.vibe.maia', raw216],
	['sparks/intent/intent.actor.maia', raw217],
	['sparks/intent/intent.context.maia', raw218],
	['sparks/intent/intent.process.maia', raw219],
	['sparks/intent/intent.view.maia', raw220],
	['sparks/manifest.vibe.maia', raw221],
	['todos/intent/intent.actor.maia', raw222],
	['todos/intent/intent.context.maia', raw223],
	['todos/intent/intent.process.maia', raw224],
	['todos/intent/intent.view.maia', raw225],
	['todos/manifest.vibe.maia', raw226],
]
export const annotateMaiaByVibesPath = Object.fromEntries(
	_vibeMaiaPairs.map(([rel, raw]) => [rel, annotateMaiaConfig(raw, rel)]),
)

const _seedPairs = [
	['icons', raw227],
	['notes', raw228],
	['todos', raw229],
]
export const SEED_DATA = Object.fromEntries(_seedPairs)
