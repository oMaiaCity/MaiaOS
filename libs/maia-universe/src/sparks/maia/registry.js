/* eslint-disable */
/**
 * GENERATED — do not edit.
 * Source: bun scripts/generate-maia-universe-registry.mjs
 */

import m_MLQ8EcLJRmN4 from '@MaiaOS/universe/actors/os/ai/actor.maia'
import m_ZXukwP1kkMUV from '@MaiaOS/universe/actors/os/ai/interface.maia'
import m_oymGE1k5djvo from '@MaiaOS/universe/actors/os/ai/process.maia'
import m_qRpEskVYQ5oo from '@MaiaOS/universe/actors/os/db/actor.maia'
import m_Ufyczm8tNTwN from '@MaiaOS/universe/actors/os/db/interface.maia'
import m_MsrqhChxw9lJ from '@MaiaOS/universe/actors/os/db/process.maia'
import m_GdUkhno8D7Wq from '@MaiaOS/universe/actors/os/messages/actor.maia'
import m_yA3nD309udXj from '@MaiaOS/universe/actors/os/messages/context.maia'
import m_EcVGVE66nL9a from '@MaiaOS/universe/actors/os/messages/interface.maia'
import m_hxZ4xuy3pYsW from '@MaiaOS/universe/actors/os/messages/process.maia'
import m_eetq9nlpKKkw from '@MaiaOS/universe/actors/services/names/actor.maia'
import m_1zZEablMEGco from '@MaiaOS/universe/actors/services/names/interface.maia'
import m_ZXLGra2wnq1n from '@MaiaOS/universe/actors/services/names/process.maia'
import m_Fvi4Q6z3X7aS from '@MaiaOS/universe/actors/services/paper/actor.maia'
import m_SrVeI3i4YFCo from '@MaiaOS/universe/actors/services/paper/context.maia'
import m_30QseHyQJTmy from '@MaiaOS/universe/actors/services/paper/interface.maia'
import m_TM4RGSMXKrAa from '@MaiaOS/universe/actors/services/paper/process.maia'
import m_8O3eF7wudvlR from '@MaiaOS/universe/actors/services/profile-image/actor.maia'
import m_WPH0KIFa57aP from '@MaiaOS/universe/actors/services/profile-image/interface.maia'
import m_kekZgD0zwrWX from '@MaiaOS/universe/actors/services/profile-image/process.maia'
import m_vv35ZGYqifye from '@MaiaOS/universe/actors/services/sandboxed-add/actor.maia'
import m_6fJkaFZwSim5 from '@MaiaOS/universe/actors/services/sandboxed-add/interface.maia'
import m_3RyP26zloTMb from '@MaiaOS/universe/actors/services/sandboxed-add/process.maia'
import m_mC7aKSEAx9g0 from '@MaiaOS/universe/actors/services/sandboxed-add/wasm.maia'
import m_nPMDld2ZbXCh from '@MaiaOS/universe/actors/services/spark/actor.maia'
import m_FQNtILqlRmaz from '@MaiaOS/universe/actors/services/spark/context.maia'
import m_DYCM4MllcXph from '@MaiaOS/universe/actors/services/spark/interface.maia'
import m_mz4egiERlCIO from '@MaiaOS/universe/actors/services/spark/process.maia'
import m_6QQTj3bsBVVS from '@MaiaOS/universe/actors/services/todos/actor.maia'
import m_KuwM9WrdZIbS from '@MaiaOS/universe/actors/services/todos/context.maia'
import m_Ba2uG083AjRl from '@MaiaOS/universe/actors/services/todos/interface.maia'
import m_zbV3Z8Gzjknc from '@MaiaOS/universe/actors/services/todos/process.maia'
import m_BU960h6g84IS from '@MaiaOS/universe/actors/services/update-wasm-code/actor.maia'
import m_Wm4jSnZWe7ZL from '@MaiaOS/universe/actors/services/update-wasm-code/inbox.maia'
import m_EXwh5INygEKJ from '@MaiaOS/universe/actors/services/update-wasm-code/interface.maia'
import m_wD2cjE2IWD9J from '@MaiaOS/universe/actors/services/update-wasm-code/process.maia'
import m_IOl2Lh54uw40 from '@MaiaOS/universe/actors/views/addressbook-avens-grid/actor.maia'
import m_007B3PE7JbEk from '@MaiaOS/universe/actors/views/addressbook-avens-grid/context.maia'
import m_K6ZcQ8FtmvDk from '@MaiaOS/universe/actors/views/addressbook-avens-grid/inbox.maia'
import m_FLv8U5tyTnsc from '@MaiaOS/universe/actors/views/addressbook-avens-grid/interface.maia'
import m_P9C7A8Ue31VU from '@MaiaOS/universe/actors/views/addressbook-grid/process.maia'
import m_QswXc4jZJu04 from '@MaiaOS/universe/actors/views/addressbook-grid/style.maia'
import m_VqSM4OGXMwT1 from '@MaiaOS/universe/actors/views/addressbook-grid/view.maia'
import m_yFBKHozblSsA from '@MaiaOS/universe/actors/views/addressbook-humans-grid/actor.maia'
import m_14QkQgllvq5x from '@MaiaOS/universe/actors/views/addressbook-humans-grid/context.maia'
import m_NGPpafBygzQO from '@MaiaOS/universe/actors/views/addressbook-humans-grid/inbox.maia'
import m_pVCkQYbJIunM from '@MaiaOS/universe/actors/views/addressbook-humans-grid/interface.maia'
import m_rYabQOLtByEe from '@MaiaOS/universe/actors/views/detail/actor.maia'
import m_bOpmjdxmIMzH from '@MaiaOS/universe/actors/views/detail/context.maia'
import m_atSfknKJlheR from '@MaiaOS/universe/actors/views/detail/interface.maia'
import m_MExHgveVR1wp from '@MaiaOS/universe/actors/views/detail/process.maia'
import m_0rLQF7lzDs4E from '@MaiaOS/universe/actors/views/detail/style.maia'
import m_j4YrhvqaHzhj from '@MaiaOS/universe/actors/views/detail/view.maia'
import m_2uOKmQavmw5P from '@MaiaOS/universe/actors/views/humans/actor.maia'
import m_nyXae6Cea0WG from '@MaiaOS/universe/actors/views/humans/context.maia'
import m_XKtxD24dtMah from '@MaiaOS/universe/actors/views/humans/interface.maia'
import m_Hv2UdNUBQE7j from '@MaiaOS/universe/actors/views/info-card/actor.maia'
import m_R6SzvxxZgrd5 from '@MaiaOS/universe/actors/views/info-card/context.maia'
import m_7UWxyQTygy7t from '@MaiaOS/universe/actors/views/info-card/interface.maia'
import m_Doa0FPc5ysAC from '@MaiaOS/universe/actors/views/info-card/process.maia'
import m_kjd2sBIEbmB8 from '@MaiaOS/universe/actors/views/info-card/style.maia'
import m_enE4OKp3Jxk3 from '@MaiaOS/universe/actors/views/info-card/view.maia'
import m_SwQem1kx98up from '@MaiaOS/universe/actors/views/input/for-chat.actor.maia'
import m_THBdFkCwVIXZ from '@MaiaOS/universe/actors/views/input/for-chat.context.maia'
import m_d0rdZg5myH1s from '@MaiaOS/universe/actors/views/input/for-chat.interface.maia'
import m_1dWDkScJduFh from '@MaiaOS/universe/actors/views/input/for-chat.process.maia'
import m_y7G0Db5JrfSI from '@MaiaOS/universe/actors/views/input/for-detail.actor.maia'
import m_W6y1PQ5kFvPl from '@MaiaOS/universe/actors/views/input/for-detail.context.maia'
import m_q5iqASAfcjPK from '@MaiaOS/universe/actors/views/input/for-detail.interface.maia'
import m_J5Wb4IdhASDa from '@MaiaOS/universe/actors/views/input/for-list.actor.maia'
import m_eDS2FiBd43oY from '@MaiaOS/universe/actors/views/input/for-list.context.maia'
import m_2RlKJG9wijpe from '@MaiaOS/universe/actors/views/input/for-list.interface.maia'
import m_ryEWGqNGarqE from '@MaiaOS/universe/actors/views/input/for-list.process.maia'
import m_MAIl6lM8g7Zr from '@MaiaOS/universe/actors/views/input/for-sparks.actor.maia'
import m_QVddxxPIeXNO from '@MaiaOS/universe/actors/views/input/for-sparks.context.maia'
import m_zqwFLWSvHKNn from '@MaiaOS/universe/actors/views/input/for-sparks.interface.maia'
import m_Cef4PGDWz1rt from '@MaiaOS/universe/actors/views/input/inbox.maia'
import m_b3FBrn8Q66D1 from '@MaiaOS/universe/actors/views/input/process.maia'
import m_xB50SA6tzwlG from '@MaiaOS/universe/actors/views/input/style.maia'
import m_GzP001yxJs77 from '@MaiaOS/universe/actors/views/input/view.maia'
import m_kDFzLDGsOcok from '@MaiaOS/universe/actors/views/layout-chat/actor.maia'
import m_sb064qZSYdEA from '@MaiaOS/universe/actors/views/layout-chat/context.maia'
import m_hry8gagTkuhs from '@MaiaOS/universe/actors/views/layout-chat/interface.maia'
import m_e6jOKN2ZAsX9 from '@MaiaOS/universe/actors/views/layout-chat/process.maia'
import m_qLauGowfDn5E from '@MaiaOS/universe/actors/views/layout-chat/view.maia'
import m_7GU32bGSAOEQ from '@MaiaOS/universe/actors/views/layout-paper/actor.maia'
import m_fufn3vCCRqRX from '@MaiaOS/universe/actors/views/layout-paper/context.maia'
import m_g1qA3atQiIzz from '@MaiaOS/universe/actors/views/layout-paper/interface.maia'
import m_IQjSYTonLsby from '@MaiaOS/universe/actors/views/layout-paper/process.maia'
import m_04ftGwYxW6eP from '@MaiaOS/universe/actors/views/layout-paper/style.maia'
import m_wkF643VPUUD6 from '@MaiaOS/universe/actors/views/layout-paper/view.maia'
import m_sT9nXs6LEQ4x from '@MaiaOS/universe/actors/views/list/actor.maia'
import m_4XMHXvRcTmYR from '@MaiaOS/universe/actors/views/list/context.maia'
import m_FCOXnOwiX85d from '@MaiaOS/universe/actors/views/list/interface.maia'
import m_7ya79kaBSg8a from '@MaiaOS/universe/actors/views/list/process.maia'
import m_UdphG1Y2pGpu from '@MaiaOS/universe/actors/views/list/style.maia'
import m_O8su53TQJ532 from '@MaiaOS/universe/actors/views/list/view.maia'
import m_jHFR021RfdWi from '@MaiaOS/universe/actors/views/list-detail/style.maia'
import m_TaDroFDU2rJ3 from '@MaiaOS/universe/actors/views/logs/actor.maia'
import m_XF1Sm9kyDOTZ from '@MaiaOS/universe/actors/views/logs/context.maia'
import m_TjtVnjOxXyqa from '@MaiaOS/universe/actors/views/logs/interface.maia'
import m_SxiDVzdTLfin from '@MaiaOS/universe/actors/views/logs/process.maia'
import m_F1pkfp3T5j4O from '@MaiaOS/universe/actors/views/logs/style.maia'
import m_pz0kWRnNJuHk from '@MaiaOS/universe/actors/views/logs/view.maia'
import m_OOB2CfxhmalY from '@MaiaOS/universe/actors/views/messages/actor.maia'
import m_H5XdYxxT9pO8 from '@MaiaOS/universe/actors/views/messages/context.maia'
import m_wbJyoU7lNyVa from '@MaiaOS/universe/actors/views/messages/interface.maia'
import m_HlKr3NTjx4fX from '@MaiaOS/universe/actors/views/messages/process.maia'
import m_EylBs2x1RR58 from '@MaiaOS/universe/actors/views/messages/style.maia'
import m_9OkoAkJ7IgN7 from '@MaiaOS/universe/actors/views/messages/view.maia'
import m_n9ws9MPStaKO from '@MaiaOS/universe/actors/views/paper/actor.maia'
import m_R9uj3NOGqAlc from '@MaiaOS/universe/actors/views/paper/context.maia'
import m_Pyx39n4wxUEI from '@MaiaOS/universe/actors/views/paper/interface.maia'
import m_FOV0Pjnx255y from '@MaiaOS/universe/actors/views/paper/process.maia'
import m_YD2WISHnA91P from '@MaiaOS/universe/actors/views/paper/style.maia'
import m_N2EzsMn8Y3mt from '@MaiaOS/universe/actors/views/paper/view.maia'
import m_czHOBTneaUIn from '@MaiaOS/universe/actors/views/placeholder/actor.maia'
import m_IwapSrjNhGmi from '@MaiaOS/universe/actors/views/placeholder/context.maia'
import m_klDGz0YvrDFl from '@MaiaOS/universe/actors/views/placeholder/interface.maia'
import m_2wCiRAAGlEx9 from '@MaiaOS/universe/actors/views/placeholder/process.maia'
import m_TGK3TdCTHR5X from '@MaiaOS/universe/actors/views/placeholder/style.maia'
import m_oOBCT4Lj0H74 from '@MaiaOS/universe/actors/views/placeholder/view.maia'
import m_2l9jBH1RcGBO from '@MaiaOS/universe/actors/views/profile-image/actor.maia'
import m_GjwqKsa5H2Q0 from '@MaiaOS/universe/actors/views/profile-image/context.maia'
import m_MBlU5oFva4Mh from '@MaiaOS/universe/actors/views/profile-image/interface.maia'
import m_1OtBaJUTzi5f from '@MaiaOS/universe/actors/views/profile-image/process.maia'
import m_37LrQG72qYZX from '@MaiaOS/universe/actors/views/profile-image/style.maia'
import m_oVzAlRvTmcJk from '@MaiaOS/universe/actors/views/profile-image/view.maia'
import m_QTi5we20xoDN from '@MaiaOS/universe/actors/views/sparks/actor.maia'
import m_3rGDd0R2NwvM from '@MaiaOS/universe/actors/views/sparks/context.maia'
import m_VI16n5B95KA8 from '@MaiaOS/universe/actors/views/sparks/interface.maia'
import m_Q5vNdpBWFDcV from '@MaiaOS/universe/actors/views/sparks/process.maia'
import m_2E6n4HGE8d84 from '@MaiaOS/universe/actors/views/sparks/style.maia'
import m_xm9pTt2aa2PF from '@MaiaOS/universe/actors/views/sparks/view.maia'
import m_bJsE58nrdeW7 from '@MaiaOS/universe/actors/views/tabs/inbox.maia'
import m_Z8ejxt4GAM3B from '@MaiaOS/universe/actors/views/tabs/process.maia'
import m_BsDx2yJXg365 from '@MaiaOS/universe/actors/views/tabs/style.maia'
import m_OS3RgD0XllLU from '@MaiaOS/universe/actors/views/tabs/todos.actor.maia'
import m_lYDwNBEbOtP9 from '@MaiaOS/universe/actors/views/tabs/todos.context.maia'
import m_ffieNhtOO7My from '@MaiaOS/universe/actors/views/tabs/todos.interface.maia'
import m_x4ee4qA2HL0K from '@MaiaOS/universe/actors/views/tabs/view.maia'
import m_dw5wMME7GWnX from '@MaiaOS/universe/data/icons/chat.maia'
import m_eDai54e5xrEv from '@MaiaOS/universe/data/icons/humans.maia'
import m_gKQfa4ddebAf from '@MaiaOS/universe/data/icons/logs.maia'
import m_OFsal1JHWA0t from '@MaiaOS/universe/data/icons/paper.maia'
import m_nD7KNPHZ6mp9 from '@MaiaOS/universe/data/icons/profile.maia'
import m_UKqnOjPwqebR from '@MaiaOS/universe/data/icons/quickjs.maia'
import m_EVErah1WB5Yd from '@MaiaOS/universe/data/icons/registries.maia'
import m_UH6c0Gz163Jc from '@MaiaOS/universe/data/icons/sparks.maia'
import m_k68km7zEav76 from '@MaiaOS/universe/data/icons/todos.maia'
import m_WZ02Qvbv3pXT from '@MaiaOS/universe/factories/actor.factory.maia'
import m_hEvDQt80UcA7 from '@MaiaOS/universe/factories/aven-identity.factory.maia'
import m_ZnfErOeG8Qa1 from '@MaiaOS/universe/factories/avens-identity-registry.factory.maia'
import m_SoT6YhM4DkrQ from '@MaiaOS/universe/factories/capability.factory.maia'
import m_NSdB7JidgoKa from '@MaiaOS/universe/factories/chat.factory.maia'
import m_32mJU9BIvKTD from '@MaiaOS/universe/factories/co-types.defs.maia'
import m_pfj0b8wowYfH from '@MaiaOS/universe/factories/cobinary.factory.maia'
import m_pr9FVA6H3emt from '@MaiaOS/universe/factories/context.factory.maia'
import m_oKm8KmoIHRel from '@MaiaOS/universe/factories/cotext.factory.maia'
import m_d9udDo57df2S from '@MaiaOS/universe/factories/event.factory.maia'
import m_ooM6RLvt6OBk from '@MaiaOS/universe/factories/factories-registry.factory.maia'
import m_JnsNCQDpaUD9 from '@MaiaOS/universe/factories/groups.factory.maia'
import m_Gom3dnloIaN8 from '@MaiaOS/universe/factories/human.factory.maia'
import m_LKzpl6u1p3CO from '@MaiaOS/universe/factories/humans-registry.factory.maia'
import m_1kZb89gUJGTN from '@MaiaOS/universe/factories/inbox.factory.maia'
import m_i3m8UWtf88qI from '@MaiaOS/universe/factories/indexes-registry.factory.maia'
import m_Dz3qruJSHyH7 from '@MaiaOS/universe/factories/maia-script-expression.factory.maia'
import m_OMS4T0ySVAMZ from '@MaiaOS/universe/factories/meta.factory.maia'
import m_xy0Fg6mnZLnR from '@MaiaOS/universe/factories/notes.factory.maia'
import m_XboetFSsok3N from '@MaiaOS/universe/factories/os-registry.factory.maia'
import m_uXfrsUnrGHwY from '@MaiaOS/universe/factories/process.factory.maia'
import m_SQhjq5w7HIEs from '@MaiaOS/universe/factories/profile.factory.maia'
import m_4NHxX1noQ5i3 from '@MaiaOS/universe/factories/registries.factory.maia'
import m_TZ0SiwQPePtq from '@MaiaOS/universe/factories/spark.factory.maia'
import m_fK5G8qpuFMth from '@MaiaOS/universe/factories/sparks-registry.factory.maia'
import m_S3AqO4jyhlDR from '@MaiaOS/universe/factories/style.factory.maia'
import m_wWWtKdywPIaU from '@MaiaOS/universe/factories/todos.factory.maia'
import m_UYzv9s5OCkqP from '@MaiaOS/universe/factories/vibe.factory.maia'
import m_XhSsupNoy9ud from '@MaiaOS/universe/factories/vibes-registry.factory.maia'
import m_f24UaNJulxXs from '@MaiaOS/universe/factories/view.factory.maia'
import m_wgytMMoilHBd from '@MaiaOS/universe/factories/wasm.factory.maia'
import m_kIIgf0iCfbAU from '@MaiaOS/universe/vibes/brand/maiacity.style.maia'
import m_b6zIxLfL7U6F from '@MaiaOS/universe/vibes/chat/intent/intent.actor.maia'
import m_pW7oUFig7GnS from '@MaiaOS/universe/vibes/chat/intent/intent.context.maia'
import m_gX2RsbLpr2ux from '@MaiaOS/universe/vibes/chat/intent/intent.process.maia'
import m_f0uOEZ57ivnw from '@MaiaOS/universe/vibes/chat/intent/intent.view.maia'
import m_GU1OICieGAZx from '@MaiaOS/universe/vibes/chat/manifest.vibe.maia'
import m_7q9UTwp141uT from '@MaiaOS/universe/vibes/humans/intent/intent.actor.maia'
import m_bAjhglq1QN3p from '@MaiaOS/universe/vibes/humans/intent/intent.context.maia'
import m_eb5PcRxreEbn from '@MaiaOS/universe/vibes/humans/intent/intent.process.maia'
import m_EnIjV7828lum from '@MaiaOS/universe/vibes/humans/intent/intent.view.maia'
import m_1n6XsI0ZNtBs from '@MaiaOS/universe/vibes/humans/manifest.vibe.maia'
import m_8RZda05XUOGd from '@MaiaOS/universe/vibes/logs/intent/intent.actor.maia'
import m_5QcEnyvON5Xe from '@MaiaOS/universe/vibes/logs/intent/intent.context.maia'
import m_B6kNjDps5u4X from '@MaiaOS/universe/vibes/logs/intent/intent.process.maia'
import m_YuS1Ux69GBXC from '@MaiaOS/universe/vibes/logs/intent/intent.view.maia'
import m_CGxAUqux4agO from '@MaiaOS/universe/vibes/logs/manifest.vibe.maia'
import m_FKlOWNzyTE3Q from '@MaiaOS/universe/vibes/paper/manifest.vibe.maia'
import m_y4ELr96pwpfc from '@MaiaOS/universe/vibes/profile/intent/intent.actor.maia'
import m_8iWEKtKvTOMu from '@MaiaOS/universe/vibes/profile/intent/intent.context.maia'
import m_Ce7Cl0T9a1xs from '@MaiaOS/universe/vibes/profile/intent/intent.process.maia'
import m_Pl6MAFGIS4hW from '@MaiaOS/universe/vibes/profile/intent/intent.view.maia'
import m_Qk4fq4jADZ43 from '@MaiaOS/universe/vibes/profile/manifest.vibe.maia'
import m_GqBpurTHeBSA from '@MaiaOS/universe/vibes/quickjs/add-form/actor.maia'
import m_PNtp1Sh3X9uz from '@MaiaOS/universe/vibes/quickjs/add-form/context.maia'
import m_f4RcjFf8QWIb from '@MaiaOS/universe/vibes/quickjs/add-form/interface.maia'
import m_i7ZIOCbuLlCZ from '@MaiaOS/universe/vibes/quickjs/add-form/process.maia'
import m_yYVLCY44Dc8J from '@MaiaOS/universe/vibes/quickjs/add-form/view.maia'
import m_Grpymj3Oj5R1 from '@MaiaOS/universe/vibes/quickjs/deps-list/actor.maia'
import m_bea6hRfoH6c0 from '@MaiaOS/universe/vibes/quickjs/deps-list/interface.maia'
import m_i83Hy1P8q2hu from '@MaiaOS/universe/vibes/quickjs/deps-list/process.maia'
import m_ZCpUzlYVunuN from '@MaiaOS/universe/vibes/quickjs/deps-list/style.maia'
import m_cFB70xEjB4fk from '@MaiaOS/universe/vibes/quickjs/deps-list/view.maia'
import m_NYVUUdK9v783 from '@MaiaOS/universe/vibes/quickjs/deps-list-detail/actor.maia'
import m_IhvLzZmyXyU3 from '@MaiaOS/universe/vibes/quickjs/deps-list-detail/context.maia'
import m_0Fgi5h1rpLCF from '@MaiaOS/universe/vibes/quickjs/deps-list-detail/interface.maia'
import m_QK0Mho2ETiZ7 from '@MaiaOS/universe/vibes/quickjs/deps-list-detail/process.maia'
import m_W0QaHbPA2tDZ from '@MaiaOS/universe/vibes/quickjs/deps-list-detail/view.maia'
import m_XV1ARTtfudRM from '@MaiaOS/universe/vibes/quickjs/intent/intent.actor.maia'
import m_5tBQe39jkMAG from '@MaiaOS/universe/vibes/quickjs/intent/intent.context.maia'
import m_vpfwDs7jV9WS from '@MaiaOS/universe/vibes/quickjs/intent/intent.process.maia'
import m_49OFyUsKeVOM from '@MaiaOS/universe/vibes/quickjs/intent/intent.view.maia'
import m_2gVESpVjSjnn from '@MaiaOS/universe/vibes/quickjs/layout-quickjs/actor.maia'
import m_HgVyMuPMjjXf from '@MaiaOS/universe/vibes/quickjs/layout-quickjs/context.maia'
import m_Q8EVlYmS4Ya9 from '@MaiaOS/universe/vibes/quickjs/layout-quickjs/interface.maia'
import m_Z67ATG5FGRdZ from '@MaiaOS/universe/vibes/quickjs/manifest.vibe.maia'
import m_7BxzYDbE0a8J from '@MaiaOS/universe/vibes/sparks/intent/intent.actor.maia'
import m_wRT5wxZ9tj6b from '@MaiaOS/universe/vibes/sparks/intent/intent.context.maia'
import m_hVe88ZqsZhmJ from '@MaiaOS/universe/vibes/sparks/intent/intent.process.maia'
import m_MXluU6t0jgmu from '@MaiaOS/universe/vibes/sparks/intent/intent.view.maia'
import m_A3qiBC3C6lt2 from '@MaiaOS/universe/vibes/sparks/manifest.vibe.maia'
import m_bpCP5HDpQTfq from '@MaiaOS/universe/vibes/todos/intent/intent.actor.maia'
import m_WJp1VRg1Doq0 from '@MaiaOS/universe/vibes/todos/intent/intent.context.maia'
import m_qWrT4xarG80I from '@MaiaOS/universe/vibes/todos/intent/intent.process.maia'
import m_KtUzIAwlaape from '@MaiaOS/universe/vibes/todos/intent/intent.view.maia'
import m_5SdJuIJ2xx0D from '@MaiaOS/universe/vibes/todos/manifest.vibe.maia'
import { annotateMaiaConfig } from '../../helpers/annotate-maia.js'
import m_wm1ZmdsK7U9N from './data/icons.data.maia'
import m_NXZN5YwuxZST from './data/notes.data.maia'
import m_7yUNIeJD8cXu from './data/todos.data.maia'

export const MAIA_SPARK_REGISTRY = Object.freeze({
	'007B3PE7JbEk': annotateMaiaConfig(m_007B3PE7JbEk, 'views/addressbook-avens-grid/context.maia'),
	'04ftGwYxW6eP': annotateMaiaConfig(m_04ftGwYxW6eP, 'views/layout-paper/style.maia'),
	'0Fgi5h1rpLCF': annotateMaiaConfig(m_0Fgi5h1rpLCF, 'quickjs/deps-list-detail/interface.maia'),
	'0rLQF7lzDs4E': annotateMaiaConfig(m_0rLQF7lzDs4E, 'views/detail/style.maia'),
	'14QkQgllvq5x': annotateMaiaConfig(m_14QkQgllvq5x, 'views/addressbook-humans-grid/context.maia'),
	'1dWDkScJduFh': annotateMaiaConfig(m_1dWDkScJduFh, 'views/input/for-chat.process.maia'),
	'1kZb89gUJGTN': annotateMaiaConfig(m_1kZb89gUJGTN, 'inbox.factory.maia'),
	'1n6XsI0ZNtBs': annotateMaiaConfig(m_1n6XsI0ZNtBs, 'humans/manifest.vibe.maia'),
	'1OtBaJUTzi5f': annotateMaiaConfig(m_1OtBaJUTzi5f, 'views/profile-image/process.maia'),
	'1zZEablMEGco': annotateMaiaConfig(m_1zZEablMEGco, 'services/names/interface.maia'),
	'2E6n4HGE8d84': annotateMaiaConfig(m_2E6n4HGE8d84, 'views/sparks/style.maia'),
	'2gVESpVjSjnn': annotateMaiaConfig(m_2gVESpVjSjnn, 'quickjs/layout-quickjs/actor.maia'),
	'2l9jBH1RcGBO': annotateMaiaConfig(m_2l9jBH1RcGBO, 'views/profile-image/actor.maia'),
	'2RlKJG9wijpe': annotateMaiaConfig(m_2RlKJG9wijpe, 'views/input/for-list.interface.maia'),
	'2uOKmQavmw5P': annotateMaiaConfig(m_2uOKmQavmw5P, 'views/humans/actor.maia'),
	'2wCiRAAGlEx9': annotateMaiaConfig(m_2wCiRAAGlEx9, 'views/placeholder/process.maia'),
	'30QseHyQJTmy': annotateMaiaConfig(m_30QseHyQJTmy, 'services/paper/interface.maia'),
	'32mJU9BIvKTD': annotateMaiaConfig(m_32mJU9BIvKTD, 'co-types.defs.maia'),
	'37LrQG72qYZX': annotateMaiaConfig(m_37LrQG72qYZX, 'views/profile-image/style.maia'),
	'3rGDd0R2NwvM': annotateMaiaConfig(m_3rGDd0R2NwvM, 'views/sparks/context.maia'),
	'3RyP26zloTMb': annotateMaiaConfig(m_3RyP26zloTMb, 'services/sandboxed-add/process.maia'),
	'49OFyUsKeVOM': annotateMaiaConfig(m_49OFyUsKeVOM, 'quickjs/intent/intent.view.maia'),
	'4NHxX1noQ5i3': annotateMaiaConfig(m_4NHxX1noQ5i3, 'registries.factory.maia'),
	'4XMHXvRcTmYR': annotateMaiaConfig(m_4XMHXvRcTmYR, 'views/list/context.maia'),
	'5QcEnyvON5Xe': annotateMaiaConfig(m_5QcEnyvON5Xe, 'logs/intent/intent.context.maia'),
	'5SdJuIJ2xx0D': annotateMaiaConfig(m_5SdJuIJ2xx0D, 'todos/manifest.vibe.maia'),
	'5tBQe39jkMAG': annotateMaiaConfig(m_5tBQe39jkMAG, 'quickjs/intent/intent.context.maia'),
	'6fJkaFZwSim5': annotateMaiaConfig(m_6fJkaFZwSim5, 'services/sandboxed-add/interface.maia'),
	'6QQTj3bsBVVS': annotateMaiaConfig(m_6QQTj3bsBVVS, 'services/todos/actor.maia'),
	'7BxzYDbE0a8J': annotateMaiaConfig(m_7BxzYDbE0a8J, 'sparks/intent/intent.actor.maia'),
	'7GU32bGSAOEQ': annotateMaiaConfig(m_7GU32bGSAOEQ, 'views/layout-paper/actor.maia'),
	'7q9UTwp141uT': annotateMaiaConfig(m_7q9UTwp141uT, 'humans/intent/intent.actor.maia'),
	'7UWxyQTygy7t': annotateMaiaConfig(m_7UWxyQTygy7t, 'views/info-card/interface.maia'),
	'7ya79kaBSg8a': annotateMaiaConfig(m_7ya79kaBSg8a, 'views/list/process.maia'),
	'7yUNIeJD8cXu': annotateMaiaConfig(m_7yUNIeJD8cXu, 'data/todos.data.maia'),
	'8iWEKtKvTOMu': annotateMaiaConfig(m_8iWEKtKvTOMu, 'profile/intent/intent.context.maia'),
	'8O3eF7wudvlR': annotateMaiaConfig(m_8O3eF7wudvlR, 'services/profile-image/actor.maia'),
	'8RZda05XUOGd': annotateMaiaConfig(m_8RZda05XUOGd, 'logs/intent/intent.actor.maia'),
	'9OkoAkJ7IgN7': annotateMaiaConfig(m_9OkoAkJ7IgN7, 'views/messages/view.maia'),
	A3qiBC3C6lt2: annotateMaiaConfig(m_A3qiBC3C6lt2, 'sparks/manifest.vibe.maia'),
	atSfknKJlheR: annotateMaiaConfig(m_atSfknKJlheR, 'views/detail/interface.maia'),
	b3FBrn8Q66D1: annotateMaiaConfig(m_b3FBrn8Q66D1, 'views/input/process.maia'),
	B6kNjDps5u4X: annotateMaiaConfig(m_B6kNjDps5u4X, 'logs/intent/intent.process.maia'),
	b6zIxLfL7U6F: annotateMaiaConfig(m_b6zIxLfL7U6F, 'chat/intent/intent.actor.maia'),
	Ba2uG083AjRl: annotateMaiaConfig(m_Ba2uG083AjRl, 'services/todos/interface.maia'),
	bAjhglq1QN3p: annotateMaiaConfig(m_bAjhglq1QN3p, 'humans/intent/intent.context.maia'),
	bea6hRfoH6c0: annotateMaiaConfig(m_bea6hRfoH6c0, 'quickjs/deps-list/interface.maia'),
	bJsE58nrdeW7: annotateMaiaConfig(m_bJsE58nrdeW7, 'views/tabs/inbox.maia'),
	bOpmjdxmIMzH: annotateMaiaConfig(m_bOpmjdxmIMzH, 'views/detail/context.maia'),
	bpCP5HDpQTfq: annotateMaiaConfig(m_bpCP5HDpQTfq, 'todos/intent/intent.actor.maia'),
	BsDx2yJXg365: annotateMaiaConfig(m_BsDx2yJXg365, 'views/tabs/style.maia'),
	BU960h6g84IS: annotateMaiaConfig(m_BU960h6g84IS, 'services/update-wasm-code/actor.maia'),
	Ce7Cl0T9a1xs: annotateMaiaConfig(m_Ce7Cl0T9a1xs, 'profile/intent/intent.process.maia'),
	Cef4PGDWz1rt: annotateMaiaConfig(m_Cef4PGDWz1rt, 'views/input/inbox.maia'),
	cFB70xEjB4fk: annotateMaiaConfig(m_cFB70xEjB4fk, 'quickjs/deps-list/view.maia'),
	CGxAUqux4agO: annotateMaiaConfig(m_CGxAUqux4agO, 'logs/manifest.vibe.maia'),
	czHOBTneaUIn: annotateMaiaConfig(m_czHOBTneaUIn, 'views/placeholder/actor.maia'),
	d0rdZg5myH1s: annotateMaiaConfig(m_d0rdZg5myH1s, 'views/input/for-chat.interface.maia'),
	d9udDo57df2S: annotateMaiaConfig(m_d9udDo57df2S, 'event.factory.maia'),
	Doa0FPc5ysAC: annotateMaiaConfig(m_Doa0FPc5ysAC, 'views/info-card/process.maia'),
	dw5wMME7GWnX: annotateMaiaConfig(m_dw5wMME7GWnX, 'data/icons/chat.maia'),
	DYCM4MllcXph: annotateMaiaConfig(m_DYCM4MllcXph, 'services/spark/interface.maia'),
	Dz3qruJSHyH7: annotateMaiaConfig(m_Dz3qruJSHyH7, 'maia-script-expression.factory.maia'),
	e6jOKN2ZAsX9: annotateMaiaConfig(m_e6jOKN2ZAsX9, 'views/layout-chat/process.maia'),
	eb5PcRxreEbn: annotateMaiaConfig(m_eb5PcRxreEbn, 'humans/intent/intent.process.maia'),
	EcVGVE66nL9a: annotateMaiaConfig(m_EcVGVE66nL9a, 'os/messages/interface.maia'),
	eDai54e5xrEv: annotateMaiaConfig(m_eDai54e5xrEv, 'data/icons/humans.maia'),
	eDS2FiBd43oY: annotateMaiaConfig(m_eDS2FiBd43oY, 'views/input/for-list.context.maia'),
	eetq9nlpKKkw: annotateMaiaConfig(m_eetq9nlpKKkw, 'services/names/actor.maia'),
	enE4OKp3Jxk3: annotateMaiaConfig(m_enE4OKp3Jxk3, 'views/info-card/view.maia'),
	EnIjV7828lum: annotateMaiaConfig(m_EnIjV7828lum, 'humans/intent/intent.view.maia'),
	EVErah1WB5Yd: annotateMaiaConfig(m_EVErah1WB5Yd, 'data/icons/registries.maia'),
	EXwh5INygEKJ: annotateMaiaConfig(m_EXwh5INygEKJ, 'services/update-wasm-code/interface.maia'),
	EylBs2x1RR58: annotateMaiaConfig(m_EylBs2x1RR58, 'views/messages/style.maia'),
	f0uOEZ57ivnw: annotateMaiaConfig(m_f0uOEZ57ivnw, 'chat/intent/intent.view.maia'),
	F1pkfp3T5j4O: annotateMaiaConfig(m_F1pkfp3T5j4O, 'views/logs/style.maia'),
	f24UaNJulxXs: annotateMaiaConfig(m_f24UaNJulxXs, 'view.factory.maia'),
	f4RcjFf8QWIb: annotateMaiaConfig(m_f4RcjFf8QWIb, 'quickjs/add-form/interface.maia'),
	FCOXnOwiX85d: annotateMaiaConfig(m_FCOXnOwiX85d, 'views/list/interface.maia'),
	ffieNhtOO7My: annotateMaiaConfig(m_ffieNhtOO7My, 'views/tabs/todos.interface.maia'),
	fK5G8qpuFMth: annotateMaiaConfig(m_fK5G8qpuFMth, 'sparks-registry.factory.maia'),
	FKlOWNzyTE3Q: annotateMaiaConfig(m_FKlOWNzyTE3Q, 'paper/manifest.vibe.maia'),
	FLv8U5tyTnsc: annotateMaiaConfig(m_FLv8U5tyTnsc, 'views/addressbook-avens-grid/interface.maia'),
	FOV0Pjnx255y: annotateMaiaConfig(m_FOV0Pjnx255y, 'views/paper/process.maia'),
	FQNtILqlRmaz: annotateMaiaConfig(m_FQNtILqlRmaz, 'services/spark/context.maia'),
	fufn3vCCRqRX: annotateMaiaConfig(m_fufn3vCCRqRX, 'views/layout-paper/context.maia'),
	Fvi4Q6z3X7aS: annotateMaiaConfig(m_Fvi4Q6z3X7aS, 'services/paper/actor.maia'),
	g1qA3atQiIzz: annotateMaiaConfig(m_g1qA3atQiIzz, 'views/layout-paper/interface.maia'),
	GdUkhno8D7Wq: annotateMaiaConfig(m_GdUkhno8D7Wq, 'os/messages/actor.maia'),
	GjwqKsa5H2Q0: annotateMaiaConfig(m_GjwqKsa5H2Q0, 'views/profile-image/context.maia'),
	gKQfa4ddebAf: annotateMaiaConfig(m_gKQfa4ddebAf, 'data/icons/logs.maia'),
	Gom3dnloIaN8: annotateMaiaConfig(m_Gom3dnloIaN8, 'human.factory.maia'),
	GqBpurTHeBSA: annotateMaiaConfig(m_GqBpurTHeBSA, 'quickjs/add-form/actor.maia'),
	Grpymj3Oj5R1: annotateMaiaConfig(m_Grpymj3Oj5R1, 'quickjs/deps-list/actor.maia'),
	GU1OICieGAZx: annotateMaiaConfig(m_GU1OICieGAZx, 'chat/manifest.vibe.maia'),
	gX2RsbLpr2ux: annotateMaiaConfig(m_gX2RsbLpr2ux, 'chat/intent/intent.process.maia'),
	GzP001yxJs77: annotateMaiaConfig(m_GzP001yxJs77, 'views/input/view.maia'),
	H5XdYxxT9pO8: annotateMaiaConfig(m_H5XdYxxT9pO8, 'views/messages/context.maia'),
	hEvDQt80UcA7: annotateMaiaConfig(m_hEvDQt80UcA7, 'aven-identity.factory.maia'),
	HgVyMuPMjjXf: annotateMaiaConfig(m_HgVyMuPMjjXf, 'quickjs/layout-quickjs/context.maia'),
	HlKr3NTjx4fX: annotateMaiaConfig(m_HlKr3NTjx4fX, 'views/messages/process.maia'),
	hry8gagTkuhs: annotateMaiaConfig(m_hry8gagTkuhs, 'views/layout-chat/interface.maia'),
	Hv2UdNUBQE7j: annotateMaiaConfig(m_Hv2UdNUBQE7j, 'views/info-card/actor.maia'),
	hVe88ZqsZhmJ: annotateMaiaConfig(m_hVe88ZqsZhmJ, 'sparks/intent/intent.process.maia'),
	hxZ4xuy3pYsW: annotateMaiaConfig(m_hxZ4xuy3pYsW, 'os/messages/process.maia'),
	i3m8UWtf88qI: annotateMaiaConfig(m_i3m8UWtf88qI, 'indexes-registry.factory.maia'),
	i7ZIOCbuLlCZ: annotateMaiaConfig(m_i7ZIOCbuLlCZ, 'quickjs/add-form/process.maia'),
	i83Hy1P8q2hu: annotateMaiaConfig(m_i83Hy1P8q2hu, 'quickjs/deps-list/process.maia'),
	IhvLzZmyXyU3: annotateMaiaConfig(m_IhvLzZmyXyU3, 'quickjs/deps-list-detail/context.maia'),
	IOl2Lh54uw40: annotateMaiaConfig(m_IOl2Lh54uw40, 'views/addressbook-avens-grid/actor.maia'),
	IQjSYTonLsby: annotateMaiaConfig(m_IQjSYTonLsby, 'views/layout-paper/process.maia'),
	IwapSrjNhGmi: annotateMaiaConfig(m_IwapSrjNhGmi, 'views/placeholder/context.maia'),
	j4YrhvqaHzhj: annotateMaiaConfig(m_j4YrhvqaHzhj, 'views/detail/view.maia'),
	J5Wb4IdhASDa: annotateMaiaConfig(m_J5Wb4IdhASDa, 'views/input/for-list.actor.maia'),
	jHFR021RfdWi: annotateMaiaConfig(m_jHFR021RfdWi, 'views/list-detail/style.maia'),
	JnsNCQDpaUD9: annotateMaiaConfig(m_JnsNCQDpaUD9, 'groups.factory.maia'),
	k68km7zEav76: annotateMaiaConfig(m_k68km7zEav76, 'data/icons/todos.maia'),
	K6ZcQ8FtmvDk: annotateMaiaConfig(m_K6ZcQ8FtmvDk, 'views/addressbook-avens-grid/inbox.maia'),
	kDFzLDGsOcok: annotateMaiaConfig(m_kDFzLDGsOcok, 'views/layout-chat/actor.maia'),
	kekZgD0zwrWX: annotateMaiaConfig(m_kekZgD0zwrWX, 'services/profile-image/process.maia'),
	kIIgf0iCfbAU: annotateMaiaConfig(m_kIIgf0iCfbAU, 'brand/maiacity.style.maia'),
	kjd2sBIEbmB8: annotateMaiaConfig(m_kjd2sBIEbmB8, 'views/info-card/style.maia'),
	klDGz0YvrDFl: annotateMaiaConfig(m_klDGz0YvrDFl, 'views/placeholder/interface.maia'),
	KtUzIAwlaape: annotateMaiaConfig(m_KtUzIAwlaape, 'todos/intent/intent.view.maia'),
	KuwM9WrdZIbS: annotateMaiaConfig(m_KuwM9WrdZIbS, 'services/todos/context.maia'),
	LKzpl6u1p3CO: annotateMaiaConfig(m_LKzpl6u1p3CO, 'humans-registry.factory.maia'),
	lYDwNBEbOtP9: annotateMaiaConfig(m_lYDwNBEbOtP9, 'views/tabs/todos.context.maia'),
	MAIl6lM8g7Zr: annotateMaiaConfig(m_MAIl6lM8g7Zr, 'views/input/for-sparks.actor.maia'),
	MBlU5oFva4Mh: annotateMaiaConfig(m_MBlU5oFva4Mh, 'views/profile-image/interface.maia'),
	mC7aKSEAx9g0: annotateMaiaConfig(m_mC7aKSEAx9g0, 'services/sandboxed-add/wasm.maia'),
	MExHgveVR1wp: annotateMaiaConfig(m_MExHgveVR1wp, 'views/detail/process.maia'),
	MLQ8EcLJRmN4: annotateMaiaConfig(m_MLQ8EcLJRmN4, 'os/ai/actor.maia'),
	MsrqhChxw9lJ: annotateMaiaConfig(m_MsrqhChxw9lJ, 'os/db/process.maia'),
	MXluU6t0jgmu: annotateMaiaConfig(m_MXluU6t0jgmu, 'sparks/intent/intent.view.maia'),
	mz4egiERlCIO: annotateMaiaConfig(m_mz4egiERlCIO, 'services/spark/process.maia'),
	N2EzsMn8Y3mt: annotateMaiaConfig(m_N2EzsMn8Y3mt, 'views/paper/view.maia'),
	n9ws9MPStaKO: annotateMaiaConfig(m_n9ws9MPStaKO, 'views/paper/actor.maia'),
	nD7KNPHZ6mp9: annotateMaiaConfig(m_nD7KNPHZ6mp9, 'data/icons/profile.maia'),
	NGPpafBygzQO: annotateMaiaConfig(m_NGPpafBygzQO, 'views/addressbook-humans-grid/inbox.maia'),
	nPMDld2ZbXCh: annotateMaiaConfig(m_nPMDld2ZbXCh, 'services/spark/actor.maia'),
	NSdB7JidgoKa: annotateMaiaConfig(m_NSdB7JidgoKa, 'chat.factory.maia'),
	NXZN5YwuxZST: annotateMaiaConfig(m_NXZN5YwuxZST, 'data/notes.data.maia'),
	NYVUUdK9v783: annotateMaiaConfig(m_NYVUUdK9v783, 'quickjs/deps-list-detail/actor.maia'),
	nyXae6Cea0WG: annotateMaiaConfig(m_nyXae6Cea0WG, 'views/humans/context.maia'),
	O8su53TQJ532: annotateMaiaConfig(m_O8su53TQJ532, 'views/list/view.maia'),
	OFsal1JHWA0t: annotateMaiaConfig(m_OFsal1JHWA0t, 'data/icons/paper.maia'),
	oKm8KmoIHRel: annotateMaiaConfig(m_oKm8KmoIHRel, 'cotext.factory.maia'),
	OMS4T0ySVAMZ: annotateMaiaConfig(m_OMS4T0ySVAMZ, 'meta.factory.maia'),
	OOB2CfxhmalY: annotateMaiaConfig(m_OOB2CfxhmalY, 'views/messages/actor.maia'),
	oOBCT4Lj0H74: annotateMaiaConfig(m_oOBCT4Lj0H74, 'views/placeholder/view.maia'),
	ooM6RLvt6OBk: annotateMaiaConfig(m_ooM6RLvt6OBk, 'factories-registry.factory.maia'),
	OS3RgD0XllLU: annotateMaiaConfig(m_OS3RgD0XllLU, 'views/tabs/todos.actor.maia'),
	oVzAlRvTmcJk: annotateMaiaConfig(m_oVzAlRvTmcJk, 'views/profile-image/view.maia'),
	oymGE1k5djvo: annotateMaiaConfig(m_oymGE1k5djvo, 'os/ai/process.maia'),
	P9C7A8Ue31VU: annotateMaiaConfig(m_P9C7A8Ue31VU, 'views/addressbook-grid/process.maia'),
	pfj0b8wowYfH: annotateMaiaConfig(m_pfj0b8wowYfH, 'cobinary.factory.maia'),
	Pl6MAFGIS4hW: annotateMaiaConfig(m_Pl6MAFGIS4hW, 'profile/intent/intent.view.maia'),
	PNtp1Sh3X9uz: annotateMaiaConfig(m_PNtp1Sh3X9uz, 'quickjs/add-form/context.maia'),
	pr9FVA6H3emt: annotateMaiaConfig(m_pr9FVA6H3emt, 'context.factory.maia'),
	pVCkQYbJIunM: annotateMaiaConfig(m_pVCkQYbJIunM, 'views/addressbook-humans-grid/interface.maia'),
	pW7oUFig7GnS: annotateMaiaConfig(m_pW7oUFig7GnS, 'chat/intent/intent.context.maia'),
	Pyx39n4wxUEI: annotateMaiaConfig(m_Pyx39n4wxUEI, 'views/paper/interface.maia'),
	pz0kWRnNJuHk: annotateMaiaConfig(m_pz0kWRnNJuHk, 'views/logs/view.maia'),
	q5iqASAfcjPK: annotateMaiaConfig(m_q5iqASAfcjPK, 'views/input/for-detail.interface.maia'),
	Q5vNdpBWFDcV: annotateMaiaConfig(m_Q5vNdpBWFDcV, 'views/sparks/process.maia'),
	Q8EVlYmS4Ya9: annotateMaiaConfig(m_Q8EVlYmS4Ya9, 'quickjs/layout-quickjs/interface.maia'),
	QK0Mho2ETiZ7: annotateMaiaConfig(m_QK0Mho2ETiZ7, 'quickjs/deps-list-detail/process.maia'),
	Qk4fq4jADZ43: annotateMaiaConfig(m_Qk4fq4jADZ43, 'profile/manifest.vibe.maia'),
	qLauGowfDn5E: annotateMaiaConfig(m_qLauGowfDn5E, 'views/layout-chat/view.maia'),
	qRpEskVYQ5oo: annotateMaiaConfig(m_qRpEskVYQ5oo, 'os/db/actor.maia'),
	QswXc4jZJu04: annotateMaiaConfig(m_QswXc4jZJu04, 'views/addressbook-grid/style.maia'),
	QTi5we20xoDN: annotateMaiaConfig(m_QTi5we20xoDN, 'views/sparks/actor.maia'),
	QVddxxPIeXNO: annotateMaiaConfig(m_QVddxxPIeXNO, 'views/input/for-sparks.context.maia'),
	qWrT4xarG80I: annotateMaiaConfig(m_qWrT4xarG80I, 'todos/intent/intent.process.maia'),
	R6SzvxxZgrd5: annotateMaiaConfig(m_R6SzvxxZgrd5, 'views/info-card/context.maia'),
	R9uj3NOGqAlc: annotateMaiaConfig(m_R9uj3NOGqAlc, 'views/paper/context.maia'),
	rYabQOLtByEe: annotateMaiaConfig(m_rYabQOLtByEe, 'views/detail/actor.maia'),
	ryEWGqNGarqE: annotateMaiaConfig(m_ryEWGqNGarqE, 'views/input/for-list.process.maia'),
	S3AqO4jyhlDR: annotateMaiaConfig(m_S3AqO4jyhlDR, 'style.factory.maia'),
	sb064qZSYdEA: annotateMaiaConfig(m_sb064qZSYdEA, 'views/layout-chat/context.maia'),
	SoT6YhM4DkrQ: annotateMaiaConfig(m_SoT6YhM4DkrQ, 'capability.factory.maia'),
	SQhjq5w7HIEs: annotateMaiaConfig(m_SQhjq5w7HIEs, 'profile.factory.maia'),
	SrVeI3i4YFCo: annotateMaiaConfig(m_SrVeI3i4YFCo, 'services/paper/context.maia'),
	sT9nXs6LEQ4x: annotateMaiaConfig(m_sT9nXs6LEQ4x, 'views/list/actor.maia'),
	SwQem1kx98up: annotateMaiaConfig(m_SwQem1kx98up, 'views/input/for-chat.actor.maia'),
	SxiDVzdTLfin: annotateMaiaConfig(m_SxiDVzdTLfin, 'views/logs/process.maia'),
	TaDroFDU2rJ3: annotateMaiaConfig(m_TaDroFDU2rJ3, 'views/logs/actor.maia'),
	TGK3TdCTHR5X: annotateMaiaConfig(m_TGK3TdCTHR5X, 'views/placeholder/style.maia'),
	THBdFkCwVIXZ: annotateMaiaConfig(m_THBdFkCwVIXZ, 'views/input/for-chat.context.maia'),
	TjtVnjOxXyqa: annotateMaiaConfig(m_TjtVnjOxXyqa, 'views/logs/interface.maia'),
	TM4RGSMXKrAa: annotateMaiaConfig(m_TM4RGSMXKrAa, 'services/paper/process.maia'),
	TZ0SiwQPePtq: annotateMaiaConfig(m_TZ0SiwQPePtq, 'spark.factory.maia'),
	UdphG1Y2pGpu: annotateMaiaConfig(m_UdphG1Y2pGpu, 'views/list/style.maia'),
	Ufyczm8tNTwN: annotateMaiaConfig(m_Ufyczm8tNTwN, 'os/db/interface.maia'),
	UH6c0Gz163Jc: annotateMaiaConfig(m_UH6c0Gz163Jc, 'data/icons/sparks.maia'),
	UKqnOjPwqebR: annotateMaiaConfig(m_UKqnOjPwqebR, 'data/icons/quickjs.maia'),
	uXfrsUnrGHwY: annotateMaiaConfig(m_uXfrsUnrGHwY, 'process.factory.maia'),
	UYzv9s5OCkqP: annotateMaiaConfig(m_UYzv9s5OCkqP, 'vibe.factory.maia'),
	VI16n5B95KA8: annotateMaiaConfig(m_VI16n5B95KA8, 'views/sparks/interface.maia'),
	vpfwDs7jV9WS: annotateMaiaConfig(m_vpfwDs7jV9WS, 'quickjs/intent/intent.process.maia'),
	VqSM4OGXMwT1: annotateMaiaConfig(m_VqSM4OGXMwT1, 'views/addressbook-grid/view.maia'),
	vv35ZGYqifye: annotateMaiaConfig(m_vv35ZGYqifye, 'services/sandboxed-add/actor.maia'),
	W0QaHbPA2tDZ: annotateMaiaConfig(m_W0QaHbPA2tDZ, 'quickjs/deps-list-detail/view.maia'),
	W6y1PQ5kFvPl: annotateMaiaConfig(m_W6y1PQ5kFvPl, 'views/input/for-detail.context.maia'),
	wbJyoU7lNyVa: annotateMaiaConfig(m_wbJyoU7lNyVa, 'views/messages/interface.maia'),
	wD2cjE2IWD9J: annotateMaiaConfig(m_wD2cjE2IWD9J, 'services/update-wasm-code/process.maia'),
	wgytMMoilHBd: annotateMaiaConfig(m_wgytMMoilHBd, 'wasm.factory.maia'),
	WJp1VRg1Doq0: annotateMaiaConfig(m_WJp1VRg1Doq0, 'todos/intent/intent.context.maia'),
	wkF643VPUUD6: annotateMaiaConfig(m_wkF643VPUUD6, 'views/layout-paper/view.maia'),
	wm1ZmdsK7U9N: annotateMaiaConfig(m_wm1ZmdsK7U9N, 'data/icons.data.maia'),
	Wm4jSnZWe7ZL: annotateMaiaConfig(m_Wm4jSnZWe7ZL, 'services/update-wasm-code/inbox.maia'),
	WPH0KIFa57aP: annotateMaiaConfig(m_WPH0KIFa57aP, 'services/profile-image/interface.maia'),
	wRT5wxZ9tj6b: annotateMaiaConfig(m_wRT5wxZ9tj6b, 'sparks/intent/intent.context.maia'),
	wWWtKdywPIaU: annotateMaiaConfig(m_wWWtKdywPIaU, 'todos.factory.maia'),
	WZ02Qvbv3pXT: annotateMaiaConfig(m_WZ02Qvbv3pXT, 'actor.factory.maia'),
	x4ee4qA2HL0K: annotateMaiaConfig(m_x4ee4qA2HL0K, 'views/tabs/view.maia'),
	xB50SA6tzwlG: annotateMaiaConfig(m_xB50SA6tzwlG, 'views/input/style.maia'),
	XboetFSsok3N: annotateMaiaConfig(m_XboetFSsok3N, 'os-registry.factory.maia'),
	XF1Sm9kyDOTZ: annotateMaiaConfig(m_XF1Sm9kyDOTZ, 'views/logs/context.maia'),
	XhSsupNoy9ud: annotateMaiaConfig(m_XhSsupNoy9ud, 'vibes-registry.factory.maia'),
	XKtxD24dtMah: annotateMaiaConfig(m_XKtxD24dtMah, 'views/humans/interface.maia'),
	xm9pTt2aa2PF: annotateMaiaConfig(m_xm9pTt2aa2PF, 'views/sparks/view.maia'),
	XV1ARTtfudRM: annotateMaiaConfig(m_XV1ARTtfudRM, 'quickjs/intent/intent.actor.maia'),
	xy0Fg6mnZLnR: annotateMaiaConfig(m_xy0Fg6mnZLnR, 'notes.factory.maia'),
	y4ELr96pwpfc: annotateMaiaConfig(m_y4ELr96pwpfc, 'profile/intent/intent.actor.maia'),
	y7G0Db5JrfSI: annotateMaiaConfig(m_y7G0Db5JrfSI, 'views/input/for-detail.actor.maia'),
	yA3nD309udXj: annotateMaiaConfig(m_yA3nD309udXj, 'os/messages/context.maia'),
	YD2WISHnA91P: annotateMaiaConfig(m_YD2WISHnA91P, 'views/paper/style.maia'),
	yFBKHozblSsA: annotateMaiaConfig(m_yFBKHozblSsA, 'views/addressbook-humans-grid/actor.maia'),
	YuS1Ux69GBXC: annotateMaiaConfig(m_YuS1Ux69GBXC, 'logs/intent/intent.view.maia'),
	yYVLCY44Dc8J: annotateMaiaConfig(m_yYVLCY44Dc8J, 'quickjs/add-form/view.maia'),
	Z67ATG5FGRdZ: annotateMaiaConfig(m_Z67ATG5FGRdZ, 'quickjs/manifest.vibe.maia'),
	Z8ejxt4GAM3B: annotateMaiaConfig(m_Z8ejxt4GAM3B, 'views/tabs/process.maia'),
	zbV3Z8Gzjknc: annotateMaiaConfig(m_zbV3Z8Gzjknc, 'services/todos/process.maia'),
	ZCpUzlYVunuN: annotateMaiaConfig(m_ZCpUzlYVunuN, 'quickjs/deps-list/style.maia'),
	ZnfErOeG8Qa1: annotateMaiaConfig(m_ZnfErOeG8Qa1, 'avens-identity-registry.factory.maia'),
	zqwFLWSvHKNn: annotateMaiaConfig(m_zqwFLWSvHKNn, 'views/input/for-sparks.interface.maia'),
	ZXLGra2wnq1n: annotateMaiaConfig(m_ZXLGra2wnq1n, 'services/names/process.maia'),
	ZXukwP1kkMUV: annotateMaiaConfig(m_ZXukwP1kkMUV, 'os/ai/interface.maia'),
})

const _iconPairs = [
	['chat', m_dw5wMME7GWnX],
	['humans', m_eDai54e5xrEv],
	['logs', m_gKQfa4ddebAf],
	['paper', m_OFsal1JHWA0t],
	['profile', m_nD7KNPHZ6mp9],
	['quickjs', m_UKqnOjPwqebR],
	['registries', m_EVErah1WB5Yd],
	['sparks', m_UH6c0Gz163Jc],
	['todos', m_k68km7zEav76],
]
export const ICON_SVG_BY_KEY = Object.fromEntries(_iconPairs.map(([key, raw]) => [key, raw.svg]))

export const DEFAULT_CARD_ICON_SVG = ICON_SVG_BY_KEY.chat ?? Object.values(ICON_SVG_BY_KEY)[0]

export function dashboardIconCotextSeedRows(vibeKeys) {
	const rows = []
	for (const key of vibeKeys) {
		const svg = ICON_SVG_BY_KEY[key]
		if (typeof svg !== 'string' || !svg.trim()) {
			throw new Error(`[vibes] dashboard icon SVG missing for vibe key "${key}"`)
		}
		rows.push({ vibeKey: key, svg })
	}
	return rows
}

export const SEED_DATA = Object.freeze({
	icons: m_wm1ZmdsK7U9N,
	notes: m_NXZN5YwuxZST,
	todos: m_7yUNIeJD8cXu,
})
