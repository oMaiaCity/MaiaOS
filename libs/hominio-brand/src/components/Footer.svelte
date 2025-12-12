<script lang="ts">
  import { browser } from "$app/environment";
  import { env as publicEnv } from "$env/dynamic/public";

  // Get base URL for legal links
  // Uses relative URLs by default, or can use PUBLIC_DOMAIN_WEBSITE if set
  function getBaseUrl(): string {
    if (!browser) return "";

    // If PUBLIC_DOMAIN_WEBSITE is set, use it (for cross-service linking)
    if (publicEnv.PUBLIC_DOMAIN_WEBSITE) {
      const websiteDomain = publicEnv.PUBLIC_DOMAIN_WEBSITE.replace(
        /^https?:\/\//,
        "",
      );
      const protocol =
        websiteDomain.startsWith("localhost") ||
        websiteDomain.startsWith("127.0.0.1")
          ? "http"
          : "https";
      return `${protocol}://${websiteDomain}`;
    }

    // Otherwise, use relative URLs (works for any service)
    return "";
  }

  const baseUrl = $derived.by(() => getBaseUrl());

  // Use relative URLs if no base URL is set, otherwise use absolute URLs
  const homeUrl = $derived(baseUrl || "/");
  const legalNoticeUrl = $derived(
    baseUrl ? `${baseUrl}/legal-notice` : "/legal-notice",
  );
  const privacyPolicyUrl = $derived(
    baseUrl ? `${baseUrl}/privacy-policy` : "/privacy-policy",
  );
  const socialMediaPolicyUrl = $derived(
    baseUrl
      ? `${baseUrl}/social-media-privacy-policy`
      : "/social-media-privacy-policy",
  );
</script>

<div class="footer-wrapper">
  <div class="footer">
    <a href={homeUrl} class="footer-link">Home</a>
    <span class="footer-separator">·</span>
    <a href={legalNoticeUrl} class="footer-link">Site Notice</a>
    <span class="footer-separator">·</span>
    <a href={privacyPolicyUrl} class="footer-link">Privacy Policy</a>
    <span class="footer-separator">·</span>
    <a href={socialMediaPolicyUrl} class="footer-link">Social Media Policy</a>
  </div>
  <div class="footer-spacer"></div>
</div>

<style>
  .footer-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-left: 1.5rem;
    padding-right: 1.5rem;
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
  }

  .footer {
    margin-top: 3rem;
    padding-top: 2rem;
    padding-bottom: 2rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    width: 100%;
    max-width: 100%;
    word-break: break-word;
  }

  .footer-link {
    font-size: 0.875rem;
    color: #6b7280;
    text-decoration: none;
    transition: color 0.2s;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .footer-link:hover {
    color: #111827;
  }

  .footer-separator {
    color: #d1d5db;
    font-size: 0.875rem;
  }

  .footer-spacer {
    height: 6rem; /* 6rem whitespace for overscroll above navbar */
    width: 100%;
    background: transparent;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .footer-wrapper {
      padding-left: 1rem;
      padding-right: 1rem;
    }

    .footer {
      margin-top: 2rem;
      padding-top: 1.5rem;
      padding-bottom: 1.5rem;
      gap: 0.5rem;
    }

    .footer-link {
      font-size: 0.75rem;
    }

    .footer-separator {
      font-size: 0.75rem;
    }
  }
</style>
