import { bootstrapNodeLogging, createLogger } from '@MaiaOS/logs'
import { avenConfigFromEnv, startAven } from './server.js'

bootstrapNodeLogging()
const log = createLogger('aven')

const config = avenConfigFromEnv()
const runtime = await startAven(config)
log.log('Aven up', {
	httpPort: runtime.http.port,
	smtpPort: runtime.smtpPort,
	hostedDomains: config.hostedDomains,
	rcptAllowlist: config.allowedRcpts?.length ?? 0,
	whitelistedMails: config.whitelistedMails?.length ?? 0,
})
