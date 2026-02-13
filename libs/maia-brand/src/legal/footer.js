/**
 * Legal footer with links to Home, Site Notice, Privacy Policy, Social Media Policy.
 * Vanilla HTML string for use in maia or other services.
 * @param {string} [baseUrl] - Optional base URL for cross-service linking (e.g. "https://maia.city")
 */
export function getFooterHTML(baseUrl = '') {
	const home = baseUrl ? `${baseUrl}/` : '/'
	const legalNotice = baseUrl ? `${baseUrl}/legal-notice` : '/legal-notice'
	const privacyPolicy = baseUrl ? `${baseUrl}/privacy-policy` : '/privacy-policy'
	const socialMedia = baseUrl
		? `${baseUrl}/social-media-privacy-policy`
		: '/social-media-privacy-policy'

	return `
<div class="footer-wrapper">
  <div class="footer">
    <a href="${home}" class="footer-link">Home</a>
    <span class="footer-separator">·</span>
    <a href="${legalNotice}" class="footer-link">Site Notice</a>
    <span class="footer-separator">·</span>
    <a href="${privacyPolicy}" class="footer-link">Privacy Policy</a>
    <span class="footer-separator">·</span>
    <a href="${socialMedia}" class="footer-link">Social Media Policy</a>
  </div>
  <div class="footer-spacer"></div>
</div>
`.trim()
}

/** Default footer HTML with relative URLs */
export const footerHTML = getFooterHTML()
