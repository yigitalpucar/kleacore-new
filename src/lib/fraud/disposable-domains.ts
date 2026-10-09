/**
 * Bundled list of disposable / throwaway e-mail domains (subset of the
 * community list github.com/disposable-email-domains, public domain / CC0),
 * kept small on purpose: the rule only adds risk weight, it never blocks.
 * Subdomains match too ("x.mailinator.com").
 */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "0-mail.com", "10minutemail.com", "10minutemail.net", "10minutemail.co.uk", "10minmail.com",
  "20minutemail.com", "33mail.com", "anonbox.net", "anonymbox.com", "armyspy.com",
  "binkmail.com", "bobmail.info", "burnermail.io", "byom.de", "chammy.info",
  "cuvox.de", "dayrep.com", "deadaddress.com", "discard.email", "discardmail.com",
  "discardmail.de", "disposableaddress.com", "disposableemailaddresses.com", "disposableinbox.com", "dispostable.com",
  "dodgit.com", "dropmail.me", "e4ward.com", "einrot.com", "email-fake.com",
  "emailfake.com", "emailondeck.com", "emailtemporanea.net", "fakeinbox.com", "fakemail.net",
  "fakemailgenerator.com", "fastacura.com", "filzmail.com", "fleckens.hu", "getairmail.com",
  "getnada.com", "gishpuppy.com", "guerrillamail.biz", "guerrillamail.com", "guerrillamail.de",
  "guerrillamail.info", "guerrillamail.net", "guerrillamail.org", "guerrillamailblock.com", "gustr.com",
  "harakirimail.com", "hmamail.com", "incognitomail.org", "inboxbear.com", "inboxkitten.com",
  "jetable.org", "jourrapide.com", "kasmail.com", "kurzepost.de", "letthemeatspam.com",
  "lroid.com", "mail-temp.com", "mail.tm", "mailcatch.com", "maildrop.cc",
  "mailexpire.com", "mailforspam.com", "mailinator.com", "mailinator.net", "mailinator2.com",
  "mailmetrash.com", "mailnesia.com", "mailnull.com", "mailpoof.com", "mailsac.com",
  "mailtemp.net", "mailtothis.com", "meltmail.com", "mintemail.com", "moakt.com",
  "mohmal.com", "mt2015.com", "mytemp.email", "mytrashmail.com", "nada.email",
  "neverbox.com", "no-spam.ws", "nospam.ze.tc", "nowmymail.com", "objectmail.com",
  "one-time.email", "onewaymail.com", "pokemail.net", "proxymail.eu", "rcpt.at",
  "rhyta.com", "sharklasers.com", "shieldemail.com", "sogetthis.com", "spam4.me",
  "spambog.com", "spambox.us", "spamgourmet.com", "spamhole.com", "spamex.com",
  "spamfree24.org", "spaml.de", "spammotel.com", "superrito.com", "teleworm.us",
  "temp-mail.io", "temp-mail.org", "temp-mail.ru", "tempail.com", "tempemail.com",
  "tempinbox.com", "tempmail.com", "tempmail.de", "tempmail.dev", "tempmail.net",
  "tempmail.plus", "tempmailaddress.com", "tempmailo.com", "tempr.email", "temporarymail.com",
  "thankyou2010.com", "throwam.com", "throwawaymail.com", "tmail.ws", "tmpmail.net",
  "tmpmail.org", "trash-mail.com", "trashmail.at", "trashmail.com", "trashmail.de",
  "trashmail.me", "trashmail.net", "trashmailer.com", "trbvm.com", "twzhhq.online",
  "wegwerfmail.de", "wegwerfmail.net", "wegwerfmail.org", "yopmail.com", "yopmail.fr",
  "yopmail.net", "zetmail.com", "zoemail.org", "emltmp.com", "fexpost.com",
  "fextemp.com", "inboxmail.life", "linshiyouxiang.net", "luxusmail.org", "minuteinbox.com",
  "smailpro.com", "spamdecoy.net", "tempmailin.com", "vomoto.com", "xojxe.com",
]);

/** Lowercased domain part of an address, or null. */
export function emailDomain(email: string | null | undefined): string | null {
  const at = email?.lastIndexOf("@") ?? -1;
  if (!email || at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase().replace(/\.$/, "");
  return domain || null;
}

export function isDisposableEmailDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  const parts = domain.toLowerCase().split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (DISPOSABLE_EMAIL_DOMAINS.has(parts.slice(i).join("."))) return true;
  }
  return false;
}

export const DISPOSABLE_DOMAIN_COUNT = DISPOSABLE_EMAIL_DOMAINS.size;
