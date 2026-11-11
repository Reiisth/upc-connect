import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://www.upc-connect.org";
const LOAD_TEST_SECRET = __ENV.LOAD_TEST_SECRET;
const TEST_EMAIL = __ENV.TEST_EMAIL;
const TEST_PASSWORD = __ENV.TEST_PASSWORD;

const profile = __ENV.LOAD_PROFILE || "1";

const profiles = {
  "1": {
    vus: 1,
    iterations: 1,
  },

  "5": {
    vus: 5,
    duration: "30s",
  },

  "10": {
    vus: 10,
    duration: "1m",
  },

  "20": {
    vus: 20,
    duration: "2m",
  },

  "25": {
    vus: 25,
    duration: "2m",
  },

  "50": {
    vus: 50,
    duration: "2m",
  },
};

export const options = {
  ...(profiles[profile] || profiles["1"]),

  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],

    "http_req_duration{page:login}": ["p(95)<1500"],
    "http_req_duration{page:dashboard}": ["p(95)<1500"],
    "http_req_duration{page:members}": ["p(95)<1500"],
    "http_req_duration{page:attendance}": ["p(95)<1500"],
    "http_req_duration{page:reports}": ["p(95)<1500"],
  },
};

function isLoginRedirect(response) {
  return String(response.headers.Location || "").includes("/login");
}

export default function () {
  // Each VU uses its own cookie jar automatically.
  // Logging in here allows each virtual user to establish an SSR cookie session.
  const loginRes = http.post(
    `${BASE_URL}/api/load-test/login`,
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "x-load-test-secret": LOAD_TEST_SECRET,
      },
      redirects: 0,
      tags: {
        page: "login",
      },
      timeout: "20s",
    }
  );

  const loginOk = check(loginRes, {
    "login: authenticated": (r) =>
      r.status === 200 && !isLoginRedirect(r),
  });

  if (!loginOk) {
    console.error(
      `login failed: status=${loginRes.status}, location=${
        loginRes.headers.Location || ""
      }, body=${loginRes.body}`
    );

    return;
  }

  sleep(1);

  // Dashboard
  const dashboardRes = http.get(`${BASE_URL}/portal`, {
    redirects: 0,
    tags: {
      page: "dashboard",
    },
    timeout: "20s",
  });

  const dashboardOk = check(dashboardRes, {
    "dashboard: authenticated": (r) =>
      (r.status === 200 ||
        [301, 302, 303, 307, 308].includes(r.status)) &&
      !isLoginRedirect(r),
  });

  if (!dashboardOk) {
    console.error(
      `dashboard failed: status=${dashboardRes.status}, location=${
        dashboardRes.headers.Location || ""
      }`
    );
  }

  sleep(1);

  // Members
  const membersRes = http.get(`${BASE_URL}/portal/members`, {
    redirects: 0,
    tags: {
      page: "members",
    },
    timeout: "20s",
  });

  const membersOk = check(membersRes, {
    "members: authenticated": (r) =>
      r.status === 200 && !isLoginRedirect(r),
  });

  if (!membersOk) {
    console.error(
      `members failed: status=${membersRes.status}, location=${
        membersRes.headers.Location || ""
      }`
    );
  }

  sleep(1);

  /*
   * Add these routes once you confirm they are valid for
   * the dedicated load-test account.
   *
   * Keeping them commented out for now prevents false failures
   * from testing pages that the account may not be authorized to use.
   */

  /*
  const attendanceRes = http.get(`${BASE_URL}/portal/attendance`, {
    redirects: 0,
    tags: {
      page: "attendance",
    },
    timeout: "20s",
  });

  check(attendanceRes, {
    "attendance: authenticated": (r) =>
      r.status === 200 && !isLoginRedirect(r),
  });

  sleep(1);

  const reportsRes = http.get(`${BASE_URL}/portal/reports`, {
    redirects: 0,
    tags: {
      page: "reports",
    },
    timeout: "20s",
  });

  check(reportsRes, {
    "reports: authenticated": (r) =>
      r.status === 200 && !isLoginRedirect(r),
  });

  sleep(1);
  */
}
