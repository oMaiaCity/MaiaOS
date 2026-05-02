/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-migrate-registries.mjs
 */

import { annotateMaiaConfig } from '../../helpers/identity-from-maia-path.js'
import act_2 from '../../seed/actors/services/ai/actor.json'
import act_3 from '../../seed/actors/services/ai/interface.json'
import act_4 from '../../seed/actors/services/ai/process.json'
import act_5 from '../../seed/actors/services/db/actor.json'
import act_6 from '../../seed/actors/services/db/interface.json'
import act_7 from '../../seed/actors/services/db/process.json'
import act_8 from '../../seed/actors/services/messages/actor.json'
import act_9 from '../../seed/actors/services/messages/context.json'
import act_10 from '../../seed/actors/services/messages/interface.json'
import act_11 from '../../seed/actors/services/messages/process.json'
import act_12 from '../../seed/actors/services/names/actor.json'
import act_13 from '../../seed/actors/services/names/interface.json'
import act_14 from '../../seed/actors/services/names/process.json'
import act_15 from '../../seed/actors/services/paper/actor.json'
import act_16 from '../../seed/actors/services/paper/context.json'
import act_17 from '../../seed/actors/services/paper/interface.json'
import act_18 from '../../seed/actors/services/paper/process.json'
import act_19 from '../../seed/actors/services/profile-image/actor.json'
import act_20 from '../../seed/actors/services/profile-image/interface.json'
import act_21 from '../../seed/actors/services/profile-image/process.json'
import act_22 from '../../seed/actors/services/sandboxed-add/actor.json'
import act_23 from '../../seed/actors/services/sandboxed-add/interface.json'
import act_24 from '../../seed/actors/services/sandboxed-add/process.json'
import act_25 from '../../seed/actors/services/sandboxed-add/wasm.json'
import act_26 from '../../seed/actors/services/spark/actor.json'
import act_27 from '../../seed/actors/services/spark/context.json'
import act_28 from '../../seed/actors/services/spark/interface.json'
import act_29 from '../../seed/actors/services/spark/process.json'
import act_30 from '../../seed/actors/services/todos/actor.json'
import act_31 from '../../seed/actors/services/todos/context.json'
import act_32 from '../../seed/actors/services/todos/interface.json'
import act_33 from '../../seed/actors/services/todos/process.json'
import act_34 from '../../seed/actors/services/update-wasm-code/actor.json'
import act_35 from '../../seed/actors/services/update-wasm-code/inbox.json'
import act_36 from '../../seed/actors/services/update-wasm-code/interface.json'
import act_37 from '../../seed/actors/services/update-wasm-code/process.json'
import act_38 from '../../seed/actors/views/addressbook-avens-grid/actor.json'
import act_39 from '../../seed/actors/views/addressbook-avens-grid/context.json'
import act_40 from '../../seed/actors/views/addressbook-avens-grid/inbox.json'
import act_41 from '../../seed/actors/views/addressbook-avens-grid/interface.json'
import act_42 from '../../seed/actors/views/addressbook-grid/process.json'
import act_43 from '../../seed/actors/views/addressbook-grid/style.json'
import act_44 from '../../seed/actors/views/addressbook-grid/view.json'
import act_45 from '../../seed/actors/views/addressbook-humans-grid/actor.json'
import act_46 from '../../seed/actors/views/addressbook-humans-grid/context.json'
import act_47 from '../../seed/actors/views/addressbook-humans-grid/inbox.json'
import act_48 from '../../seed/actors/views/addressbook-humans-grid/interface.json'
import act_49 from '../../seed/actors/views/detail/actor.json'
import act_50 from '../../seed/actors/views/detail/context.json'
import act_51 from '../../seed/actors/views/detail/interface.json'
import act_52 from '../../seed/actors/views/detail/process.json'
import act_53 from '../../seed/actors/views/detail/style.json'
import act_54 from '../../seed/actors/views/detail/view.json'
import act_55 from '../../seed/actors/views/humans/actor.json'
import act_56 from '../../seed/actors/views/humans/context.json'
import act_57 from '../../seed/actors/views/humans/interface.json'
import act_58 from '../../seed/actors/views/info-card/actor.json'
import act_59 from '../../seed/actors/views/info-card/context.json'
import act_60 from '../../seed/actors/views/info-card/interface.json'
import act_61 from '../../seed/actors/views/info-card/process.json'
import act_62 from '../../seed/actors/views/info-card/style.json'
import act_63 from '../../seed/actors/views/info-card/view.json'
import act_64 from '../../seed/actors/views/input/for-chat.actor.json'
import act_65 from '../../seed/actors/views/input/for-chat.context.json'
import act_66 from '../../seed/actors/views/input/for-chat.interface.json'
import act_67 from '../../seed/actors/views/input/for-chat.process.json'
import act_68 from '../../seed/actors/views/input/for-detail.actor.json'
import act_69 from '../../seed/actors/views/input/for-detail.context.json'
import act_70 from '../../seed/actors/views/input/for-detail.interface.json'
import act_71 from '../../seed/actors/views/input/for-list.actor.json'
import act_72 from '../../seed/actors/views/input/for-list.context.json'
import act_73 from '../../seed/actors/views/input/for-list.interface.json'
import act_74 from '../../seed/actors/views/input/for-list.process.json'
import act_75 from '../../seed/actors/views/input/for-sparks.actor.json'
import act_76 from '../../seed/actors/views/input/for-sparks.context.json'
import act_77 from '../../seed/actors/views/input/for-sparks.interface.json'
import act_78 from '../../seed/actors/views/input/inbox.json'
import act_79 from '../../seed/actors/views/input/process.json'
import act_80 from '../../seed/actors/views/input/style.json'
import act_81 from '../../seed/actors/views/input/view.json'
import act_82 from '../../seed/actors/views/layout-chat/actor.json'
import act_83 from '../../seed/actors/views/layout-chat/context.json'
import act_84 from '../../seed/actors/views/layout-chat/interface.json'
import act_85 from '../../seed/actors/views/layout-chat/process.json'
import act_86 from '../../seed/actors/views/layout-chat/view.json'
import act_87 from '../../seed/actors/views/layout-paper/actor.json'
import act_88 from '../../seed/actors/views/layout-paper/context.json'
import act_89 from '../../seed/actors/views/layout-paper/interface.json'
import act_90 from '../../seed/actors/views/layout-paper/process.json'
import act_91 from '../../seed/actors/views/layout-paper/style.json'
import act_92 from '../../seed/actors/views/layout-paper/view.json'
import act_94 from '../../seed/actors/views/list/actor.json'
import act_95 from '../../seed/actors/views/list/context.json'
import act_96 from '../../seed/actors/views/list/interface.json'
import act_97 from '../../seed/actors/views/list/process.json'
import act_98 from '../../seed/actors/views/list/style.json'
import act_99 from '../../seed/actors/views/list/view.json'
import act_93 from '../../seed/actors/views/list-detail/style.json'
import act_100 from '../../seed/actors/views/logs/actor.json'
import act_101 from '../../seed/actors/views/logs/context.json'
import act_102 from '../../seed/actors/views/logs/interface.json'
import act_103 from '../../seed/actors/views/logs/process.json'
import act_104 from '../../seed/actors/views/logs/style.json'
import act_105 from '../../seed/actors/views/logs/view.json'
import act_106 from '../../seed/actors/views/messages/actor.json'
import act_107 from '../../seed/actors/views/messages/context.json'
import act_108 from '../../seed/actors/views/messages/interface.json'
import act_109 from '../../seed/actors/views/messages/process.json'
import act_110 from '../../seed/actors/views/messages/style.json'
import act_111 from '../../seed/actors/views/messages/view.json'
import act_112 from '../../seed/actors/views/paper/actor.json'
import act_113 from '../../seed/actors/views/paper/context.json'
import act_114 from '../../seed/actors/views/paper/interface.json'
import act_115 from '../../seed/actors/views/paper/process.json'
import act_116 from '../../seed/actors/views/paper/style.json'
import act_117 from '../../seed/actors/views/paper/view.json'
import act_118 from '../../seed/actors/views/placeholder/actor.json'
import act_119 from '../../seed/actors/views/placeholder/context.json'
import act_120 from '../../seed/actors/views/placeholder/interface.json'
import act_121 from '../../seed/actors/views/placeholder/process.json'
import act_122 from '../../seed/actors/views/placeholder/style.json'
import act_123 from '../../seed/actors/views/placeholder/view.json'
import act_124 from '../../seed/actors/views/profile-image/actor.json'
import act_125 from '../../seed/actors/views/profile-image/context.json'
import act_126 from '../../seed/actors/views/profile-image/interface.json'
import act_127 from '../../seed/actors/views/profile-image/process.json'
import act_128 from '../../seed/actors/views/profile-image/style.json'
import act_129 from '../../seed/actors/views/profile-image/view.json'
import act_130 from '../../seed/actors/views/sparks/actor.json'
import act_131 from '../../seed/actors/views/sparks/context.json'
import act_132 from '../../seed/actors/views/sparks/interface.json'
import act_133 from '../../seed/actors/views/sparks/process.json'
import act_134 from '../../seed/actors/views/sparks/style.json'
import act_135 from '../../seed/actors/views/sparks/view.json'
import act_136 from '../../seed/actors/views/tabs/inbox.json'
import act_137 from '../../seed/actors/views/tabs/process.json'
import act_138 from '../../seed/actors/views/tabs/style.json'
import act_139 from '../../seed/actors/views/tabs/todos.actor.json'
import act_140 from '../../seed/actors/views/tabs/todos.context.json'
import act_141 from '../../seed/actors/views/tabs/todos.interface.json'
import act_142 from '../../seed/actors/views/tabs/view.json'
import act_1 from '../../seed/brand/maiacity.style.json'

export const MAIA_SPARK_REGISTRY = Object.freeze({
	JuCJ5s7LgcII: annotateMaiaConfig(act_1, 'brand/maiacity.style.json'),
	illngc3hbx2S: annotateMaiaConfig(act_2, 'services/ai/actor.json'),
	pnTXcWEWFbTQ: annotateMaiaConfig(act_3, 'services/ai/interface.json'),
	nMLJkx2eof8b: annotateMaiaConfig(act_4, 'services/ai/process.json'),
	FJvDyt6xkQHK: annotateMaiaConfig(act_5, 'services/db/actor.json'),
	'5ZhDkarM4FuB': annotateMaiaConfig(act_6, 'services/db/interface.json'),
	NfQJgovMt6DB: annotateMaiaConfig(act_7, 'services/db/process.json'),
	'1iaOvHL40a4a': annotateMaiaConfig(act_8, 'services/messages/actor.json'),
	e6sDd19wYu38: annotateMaiaConfig(act_9, 'services/messages/context.json'),
	cBpLN88nUp1N: annotateMaiaConfig(act_10, 'services/messages/interface.json'),
	xCE2WpfmaVzR: annotateMaiaConfig(act_11, 'services/messages/process.json'),
	rSnu2p991C4c: annotateMaiaConfig(act_12, 'services/names/actor.json'),
	oDT3u3km8EWd: annotateMaiaConfig(act_13, 'services/names/interface.json'),
	dTzSeiJDNjB1: annotateMaiaConfig(act_14, 'services/names/process.json'),
	BClzfrRRJjez: annotateMaiaConfig(act_15, 'services/paper/actor.json'),
	f32qrjEWT8vh: annotateMaiaConfig(act_16, 'services/paper/context.json'),
	L1yzPPKeYu3B: annotateMaiaConfig(act_17, 'services/paper/interface.json'),
	w32cSdDXngne: annotateMaiaConfig(act_18, 'services/paper/process.json'),
	lsvgkCiIHfOV: annotateMaiaConfig(act_19, 'services/profile-image/actor.json'),
	'6lWJPWHGtYyf': annotateMaiaConfig(act_20, 'services/profile-image/interface.json'),
	'9KdXIc1C0Fnk': annotateMaiaConfig(act_21, 'services/profile-image/process.json'),
	'32qrgokpTfKJ': annotateMaiaConfig(act_22, 'services/sandboxed-add/actor.json'),
	fg3JYsJmIlO9: annotateMaiaConfig(act_23, 'services/sandboxed-add/interface.json'),
	ASGsOCdmVW2J: annotateMaiaConfig(act_24, 'services/sandboxed-add/process.json'),
	QfLFLc1lMMz3: annotateMaiaConfig(act_25, 'services/sandboxed-add/wasm.json'),
	rPBMu9qV56Ji: annotateMaiaConfig(act_26, 'services/spark/actor.json'),
	RAEo8klC8Pnf: annotateMaiaConfig(act_27, 'services/spark/context.json'),
	KXbAYya4DoRr: annotateMaiaConfig(act_28, 'services/spark/interface.json'),
	'8Tv1pdbIUZ5v': annotateMaiaConfig(act_29, 'services/spark/process.json'),
	'6tiyDImF6AhW': annotateMaiaConfig(act_30, 'services/todos/actor.json'),
	FCBVmlI0qW5B: annotateMaiaConfig(act_31, 'services/todos/context.json'),
	GjrOuAMNeiV2: annotateMaiaConfig(act_32, 'services/todos/interface.json'),
	V3KYSRKTR24e: annotateMaiaConfig(act_33, 'services/todos/process.json'),
	EdZ2wvbe7sLc: annotateMaiaConfig(act_34, 'services/update-wasm-code/actor.json'),
	PaAJR7AYmNMf: annotateMaiaConfig(act_35, 'services/update-wasm-code/inbox.json'),
	zaUb7oM7cdwP: annotateMaiaConfig(act_36, 'services/update-wasm-code/interface.json'),
	jKvcfQl45Sim: annotateMaiaConfig(act_37, 'services/update-wasm-code/process.json'),
	kpv6GzDXLrA1: annotateMaiaConfig(act_38, 'views/addressbook-avens-grid/actor.json'),
	T2tK4vmv14J4: annotateMaiaConfig(act_39, 'views/addressbook-avens-grid/context.json'),
	tIUKj5N1gKtr: annotateMaiaConfig(act_40, 'views/addressbook-avens-grid/inbox.json'),
	ikTcAtU9aNzl: annotateMaiaConfig(act_41, 'views/addressbook-avens-grid/interface.json'),
	jkuLp8bH4kC6: annotateMaiaConfig(act_42, 'views/addressbook-grid/process.json'),
	X0eNWbfzTX3P: annotateMaiaConfig(act_43, 'views/addressbook-grid/style.json'),
	'6COySDAv2oWu': annotateMaiaConfig(act_44, 'views/addressbook-grid/view.json'),
	vnYp5e99Q1e9: annotateMaiaConfig(act_45, 'views/addressbook-humans-grid/actor.json'),
	XdcE3hv2H0NI: annotateMaiaConfig(act_46, 'views/addressbook-humans-grid/context.json'),
	mCIPfqvbLUEz: annotateMaiaConfig(act_47, 'views/addressbook-humans-grid/inbox.json'),
	ePmyzruntsum: annotateMaiaConfig(act_48, 'views/addressbook-humans-grid/interface.json'),
	GWLhEjqiZ2m4: annotateMaiaConfig(act_49, 'views/detail/actor.json'),
	xUI7riGpdSrt: annotateMaiaConfig(act_50, 'views/detail/context.json'),
	LI10ucwAEHSy: annotateMaiaConfig(act_51, 'views/detail/interface.json'),
	wUGGN9xoAR41: annotateMaiaConfig(act_52, 'views/detail/process.json'),
	PECjDL73xVr2: annotateMaiaConfig(act_53, 'views/detail/style.json'),
	GBlIIht0Lntt: annotateMaiaConfig(act_54, 'views/detail/view.json'),
	Exu2qfZ964vE: annotateMaiaConfig(act_55, 'views/humans/actor.json'),
	Gs5I1OcMS2dc: annotateMaiaConfig(act_56, 'views/humans/context.json'),
	hiZRt8xNrr3N: annotateMaiaConfig(act_57, 'views/humans/interface.json'),
	ciHtv5fsSIm5: annotateMaiaConfig(act_58, 'views/info-card/actor.json'),
	cJBfT0itoTvI: annotateMaiaConfig(act_59, 'views/info-card/context.json'),
	fJfuDCu7vEvI: annotateMaiaConfig(act_60, 'views/info-card/interface.json'),
	kKQ5Now411Hk: annotateMaiaConfig(act_61, 'views/info-card/process.json'),
	'3KDQ7Z06qApN': annotateMaiaConfig(act_62, 'views/info-card/style.json'),
	KiCdjHRM9syz: annotateMaiaConfig(act_63, 'views/info-card/view.json'),
	OqoYAPTbPULZ: annotateMaiaConfig(act_64, 'views/input/for-chat.actor.json'),
	psrWAuBWAVv6: annotateMaiaConfig(act_65, 'views/input/for-chat.context.json'),
	UwJKkSjJkjKY: annotateMaiaConfig(act_66, 'views/input/for-chat.interface.json'),
	KWepqZBBDs2Y: annotateMaiaConfig(act_67, 'views/input/for-chat.process.json'),
	TKbMgSBDL3zW: annotateMaiaConfig(act_68, 'views/input/for-detail.actor.json'),
	krotbDCKR0e6: annotateMaiaConfig(act_69, 'views/input/for-detail.context.json'),
	CamL9mq90A7G: annotateMaiaConfig(act_70, 'views/input/for-detail.interface.json'),
	nv7al4whqqn4: annotateMaiaConfig(act_71, 'views/input/for-list.actor.json'),
	f3k1sIv3CbB8: annotateMaiaConfig(act_72, 'views/input/for-list.context.json'),
	tphAqTT7V968: annotateMaiaConfig(act_73, 'views/input/for-list.interface.json'),
	xdzK20dGGfCs: annotateMaiaConfig(act_74, 'views/input/for-list.process.json'),
	'9VWAxf53YSqp': annotateMaiaConfig(act_75, 'views/input/for-sparks.actor.json'),
	jrJkgugzOjrn: annotateMaiaConfig(act_76, 'views/input/for-sparks.context.json'),
	J2cmipRvAnVe: annotateMaiaConfig(act_77, 'views/input/for-sparks.interface.json'),
	eFXsrFE6kE3m: annotateMaiaConfig(act_78, 'views/input/inbox.json'),
	N73eWQDCv1W1: annotateMaiaConfig(act_79, 'views/input/process.json'),
	ex5ZM2OJ5B0c: annotateMaiaConfig(act_80, 'views/input/style.json'),
	'6dUp7xJVkX7j': annotateMaiaConfig(act_81, 'views/input/view.json'),
	'3AkLf2eaoEfo': annotateMaiaConfig(act_82, 'views/layout-chat/actor.json'),
	i8B03lq1bXsc: annotateMaiaConfig(act_83, 'views/layout-chat/context.json'),
	'2JhNt0ZWZpUv': annotateMaiaConfig(act_84, 'views/layout-chat/interface.json'),
	'0dG2J13LbPbG': annotateMaiaConfig(act_85, 'views/layout-chat/process.json'),
	vacR1EFc0ids: annotateMaiaConfig(act_86, 'views/layout-chat/view.json'),
	MhA5Y4fRP0on: annotateMaiaConfig(act_87, 'views/layout-paper/actor.json'),
	SR7tyEsggRix: annotateMaiaConfig(act_88, 'views/layout-paper/context.json'),
	'7WkaTn1m7gXh': annotateMaiaConfig(act_89, 'views/layout-paper/interface.json'),
	fB91NJbnnh1g: annotateMaiaConfig(act_90, 'views/layout-paper/process.json'),
	YUacRTIUSgHl: annotateMaiaConfig(act_91, 'views/layout-paper/style.json'),
	EiTCxHXfprhY: annotateMaiaConfig(act_92, 'views/layout-paper/view.json'),
	RYsIBSRa0y2w: annotateMaiaConfig(act_93, 'views/list-detail/style.json'),
	JDgt5jdiu6PY: annotateMaiaConfig(act_94, 'views/list/actor.json'),
	zjAonZm6Wfj5: annotateMaiaConfig(act_95, 'views/list/context.json'),
	TXHVI8Dsb2nb: annotateMaiaConfig(act_96, 'views/list/interface.json'),
	'9xws3cGoaayz': annotateMaiaConfig(act_97, 'views/list/process.json'),
	PH1YlifFd3SX: annotateMaiaConfig(act_98, 'views/list/style.json'),
	CUu5awRVLQN2: annotateMaiaConfig(act_99, 'views/list/view.json'),
	dwLPc6SkDU8I: annotateMaiaConfig(act_100, 'views/logs/actor.json'),
	gp8ovR1xoRVx: annotateMaiaConfig(act_101, 'views/logs/context.json'),
	YfINQh5ZIrVD: annotateMaiaConfig(act_102, 'views/logs/interface.json'),
	GQ0H0VGxCfSA: annotateMaiaConfig(act_103, 'views/logs/process.json'),
	dg3TvNhO0nnB: annotateMaiaConfig(act_104, 'views/logs/style.json'),
	G5s4KeYxPmC7: annotateMaiaConfig(act_105, 'views/logs/view.json'),
	pgbvFqpda8R5: annotateMaiaConfig(act_106, 'views/messages/actor.json'),
	'3NaJ58DmayUy': annotateMaiaConfig(act_107, 'views/messages/context.json'),
	qdlzzRZV5rQr: annotateMaiaConfig(act_108, 'views/messages/interface.json'),
	NKy1RwJUv1PC: annotateMaiaConfig(act_109, 'views/messages/process.json'),
	VGfyRgjTodzJ: annotateMaiaConfig(act_110, 'views/messages/style.json'),
	ZQanF8KezO3g: annotateMaiaConfig(act_111, 'views/messages/view.json'),
	vnoLJ5IR3Fhn: annotateMaiaConfig(act_112, 'views/paper/actor.json'),
	dvmp4K5nLKG3: annotateMaiaConfig(act_113, 'views/paper/context.json'),
	oZCzL6qLaASR: annotateMaiaConfig(act_114, 'views/paper/interface.json'),
	HvoAoMwsRWSH: annotateMaiaConfig(act_115, 'views/paper/process.json'),
	DDcMxzuwzy3Z: annotateMaiaConfig(act_116, 'views/paper/style.json'),
	ZRbtxAikEkz4: annotateMaiaConfig(act_117, 'views/paper/view.json'),
	LLMuUtuHzCFV: annotateMaiaConfig(act_118, 'views/placeholder/actor.json'),
	yED2qwAuv5Uw: annotateMaiaConfig(act_119, 'views/placeholder/context.json'),
	Gj7fn7t4y5jW: annotateMaiaConfig(act_120, 'views/placeholder/interface.json'),
	'7os7h9jocbuS': annotateMaiaConfig(act_121, 'views/placeholder/process.json'),
	pMX9kEE319Ob: annotateMaiaConfig(act_122, 'views/placeholder/style.json'),
	X40tTm8wWyXG: annotateMaiaConfig(act_123, 'views/placeholder/view.json'),
	'3JNccaCLLlM6': annotateMaiaConfig(act_124, 'views/profile-image/actor.json'),
	x4dZkgqp8IsA: annotateMaiaConfig(act_125, 'views/profile-image/context.json'),
	Vv8xFZgWfLTP: annotateMaiaConfig(act_126, 'views/profile-image/interface.json'),
	'22sq9VH5cKno': annotateMaiaConfig(act_127, 'views/profile-image/process.json'),
	'5xELt8IBLDVY': annotateMaiaConfig(act_128, 'views/profile-image/style.json'),
	tmzM1JS5lHXj: annotateMaiaConfig(act_129, 'views/profile-image/view.json'),
	unS8TSSLL9Dy: annotateMaiaConfig(act_130, 'views/sparks/actor.json'),
	Culky16KuwUN: annotateMaiaConfig(act_131, 'views/sparks/context.json'),
	F1uEuTQ5uQUF: annotateMaiaConfig(act_132, 'views/sparks/interface.json'),
	Jgqt6iXq4xhq: annotateMaiaConfig(act_133, 'views/sparks/process.json'),
	'1SAGhn8t3QGy': annotateMaiaConfig(act_134, 'views/sparks/style.json'),
	'8zoabrvHr6M2': annotateMaiaConfig(act_135, 'views/sparks/view.json'),
	'4U5SFb7SFxQe': annotateMaiaConfig(act_136, 'views/tabs/inbox.json'),
	kQwUAfrVZbBz: annotateMaiaConfig(act_137, 'views/tabs/process.json'),
	A6PmDNKohAoB: annotateMaiaConfig(act_138, 'views/tabs/style.json'),
	'8JcNumpr9tun': annotateMaiaConfig(act_139, 'views/tabs/todos.actor.json'),
	aay4OYIt39pL: annotateMaiaConfig(act_140, 'views/tabs/todos.context.json'),
	LtaWCD15CGP8: annotateMaiaConfig(act_141, 'views/tabs/todos.interface.json'),
	mhU1upOEt82s: annotateMaiaConfig(act_142, 'views/tabs/view.json'),
})
