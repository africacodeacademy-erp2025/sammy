// src/app/api/debug/network-test/route.ts
import { NextResponse } from "next/server";

/**
 * Network Diagnostics Endpoint
 * Tests connectivity to LinkedIn API and other external services
 *
 * Usage: GET /api/debug/network-test
 */
export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      platform: process.platform,
      nodeVersion: process.version,
      hasLinkedInCredentials: !!(
        process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET
      ),
    },
    tests: [],
  };

  // Test 1: DNS resolution for api.linkedin.com
  console.log("🔍 Testing DNS resolution...");
  try {
    const dns = await import("dns").then((m) => m.promises);
    const addresses = await dns.resolve4("api.linkedin.com");
    results.tests.push({
      name: "DNS Resolution (api.linkedin.com)",
      status: "success",
      addresses: addresses,
      message: `Resolved to ${addresses.length} IP address(es)`,
    });
  } catch (dnsError: any) {
    results.tests.push({
      name: "DNS Resolution (api.linkedin.com)",
      status: "failed",
      error: dnsError.message,
      code: dnsError.code,
      message: "DNS resolution failed - server cannot resolve api.linkedin.com",
    });
  }

  // Test 2: Basic HTTPS connectivity to LinkedIn (HEAD request)
  console.log("🔍 Testing HTTPS connectivity...");
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const startTime = Date.now();
    const response = await fetch("https://api.linkedin.com/v2/me", {
      method: "HEAD",
      headers: {
        "User-Agent": "SammyApp-NetworkTest/1.0",
      },
      signal: controller.signal,
    });
    const duration = Date.now() - startTime;

    clearTimeout(timeoutId);

    results.tests.push({
      name: "HTTPS Connectivity (HEAD /v2/me)",
      status: "success",
      statusCode: response.status,
      duration: `${duration}ms`,
      headers: Object.fromEntries(response.headers),
      message: `Server can reach api.linkedin.com (status: ${response.status}, time: ${duration}ms)`,
    });
  } catch (fetchError: any) {
    results.tests.push({
      name: "HTTPS Connectivity (HEAD /v2/me)",
      status: "failed",
      error: fetchError.message,
      errorName: fetchError.name,
      errorCode: fetchError.code,
      cause: fetchError.cause?.message || fetchError.cause,
      message: getNetworkErrorMessage(fetchError),
    });
  }

  // Test 3: Try with invalid auth (should get 401, not network error)
  console.log("🔍 Testing API response with invalid auth...");
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const startTime = Date.now();
    const response = await fetch("https://api.linkedin.com/v2/me", {
      headers: {
        Authorization: "Bearer invalid_token_for_testing",
        "User-Agent": "SammyApp-NetworkTest/1.0",
      },
      signal: controller.signal,
    });
    const duration = Date.now() - startTime;

    clearTimeout(timeoutId);

    const text = await response.text();
    results.tests.push({
      name: "API Response Test (invalid auth)",
      status: response.status === 401 ? "success" : "warning",
      statusCode: response.status,
      duration: `${duration}ms`,
      responsePreview: text.substring(0, 200),
      message:
        response.status === 401
          ? "✅ API is reachable and responding correctly (401 Unauthorized)"
          : `⚠️ Unexpected status: ${response.status}`,
    });
  } catch (fetchError: any) {
    results.tests.push({
      name: "API Response Test (invalid auth)",
      status: "failed",
      error: fetchError.message,
      errorName: fetchError.name,
      errorCode: fetchError.code,
      message: "Cannot reach LinkedIn API even with auth header",
    });
  }

  // Test 4: Test www.linkedin.com (public website)
  console.log("🔍 Testing public LinkedIn website...");
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const startTime = Date.now();
    const response = await fetch("https://www.linkedin.com", {
      method: "HEAD",
      signal: controller.signal,
    });
    const duration = Date.now() - startTime;

    clearTimeout(timeoutId);

    results.tests.push({
      name: "Public Website (www.linkedin.com)",
      status: "success",
      statusCode: response.status,
      duration: `${duration}ms`,
      message: `Can reach public LinkedIn website (${duration}ms)`,
    });
  } catch (fetchError: any) {
    results.tests.push({
      name: "Public Website (www.linkedin.com)",
      status: "failed",
      error: fetchError.message,
      errorCode: fetchError.code,
      message: "Cannot reach www.linkedin.com - possible firewall block",
    });
  }

  // Test 5: Test a different API (Google) to verify general internet connectivity
  console.log("🔍 Testing general internet connectivity...");
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const startTime = Date.now();
    const response = await fetch("https://www.google.com", {
      method: "HEAD",
      signal: controller.signal,
    });
    const duration = Date.now() - startTime;

    clearTimeout(timeoutId);

    results.tests.push({
      name: "General Internet (google.com)",
      status: "success",
      statusCode: response.status,
      duration: `${duration}ms`,
      message: "Server has general internet connectivity",
    });
  } catch (fetchError: any) {
    results.tests.push({
      name: "General Internet (google.com)",
      status: "failed",
      error: fetchError.message,
      message: "Server has no internet connectivity or all outbound blocked",
    });
  }

  // Calculate summary
  const successCount = results.tests.filter(
    (t: any) => t.status === "success"
  ).length;
  const failedCount = results.tests.filter(
    (t: any) => t.status === "failed"
  ).length;

  results.summary = {
    total: results.tests.length,
    passed: successCount,
    failed: failedCount,
    verdict: getVerdict(results.tests),
  };

  console.log("=== Network Test Results ===");
  console.log(JSON.stringify(results, null, 2));

  return NextResponse.json(results);
}

function getNetworkErrorMessage(error: any): string {
  const code = error.code || error.name;

  const messages: Record<string, string> = {
    ENOTFOUND: "❌ DNS Error: Cannot resolve api.linkedin.com hostname",
    ECONNREFUSED: "❌ Connection Refused: LinkedIn API refused the connection",
    ETIMEDOUT: "❌ Timeout: No response from LinkedIn API",
    UND_ERR_CONNECT_TIMEOUT:
      "❌ Connection Timeout: Cannot establish connection to LinkedIn",
    AbortError: "❌ Request Timeout: LinkedIn API took too long to respond",
    ECONNRESET: "❌ Connection Reset: Connection was dropped during request",
    EHOSTUNREACH: "❌ Host Unreachable: Cannot route to api.linkedin.com",
  };

  return (
    messages[code] ||
    `❌ Network Error: ${error.message} (code: ${code || "unknown"})`
  );
}

function getVerdict(tests: any[]): string {
  const linkedinApiTest = tests.find((t) =>
    t.name.includes("HTTPS Connectivity")
  );
  const dnsTest = tests.find((t) => t.name.includes("DNS Resolution"));
  const googleTest = tests.find((t) => t.name.includes("General Internet"));

  if (linkedinApiTest?.status === "success") {
    return "✅ All systems operational - LinkedIn API is reachable";
  }

  if (dnsTest?.status === "failed") {
    return "❌ DNS FAILURE: Server cannot resolve api.linkedin.com. Check DNS settings.";
  }

  if (
    googleTest?.status === "success" &&
    linkedinApiTest?.status === "failed"
  ) {
    return "❌ FIREWALL BLOCK: Server has internet but cannot reach LinkedIn. Check firewall/egress rules.";
  }

  if (googleTest?.status === "failed") {
    return "❌ NO INTERNET: Server has no outbound internet connectivity.";
  }

  return "⚠️ PARTIAL CONNECTIVITY: Some tests failed. Review individual test results.";
}
