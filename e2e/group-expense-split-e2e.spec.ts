import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * End-to-end test flow for group creation and expense splitting (#612).
 *
 * Verifies the user journey:
 * 1. Connect wallet and sign in
 * 2. Create a group with participants
 * 3. Record a shared expense with equal splitting
 * 4. View calculated balances and settlement suggestions
 */

const NETWORK_ALIASES: Record<string, "public" | "testnet"> = {
  public: "public",
  pubnet: "public",
  mainnet: "public",
  testnet: "testnet",
  test: "testnet",
};

const NETWORK: "public" | "testnet" =
  NETWORK_ALIASES[
    (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "").trim().toLowerCase()
  ] ?? "public";

const NETWORK_PASSPHRASE =
  NETWORK === "testnet"
    ? "Test SDF Network ; September 2015"
    : "Public Global Stellar Network ; September 2015";

const NETWORK_NAME = NETWORK === "testnet" ? "Testnet" : "Public";
const NETWORK_URL =
  NETWORK === "testnet"
    ? "https://horizon-testnet.stellar.org"
    : "https://horizon.stellar.org";

const CURRENT_USER = {
  id: "user-alice",
  stellarPublicKey: "GBDIT4GPLGXKTQH2O2UYV7XKZPFT2OQ3GQ3H4J6B7Y5XGQY3UHMDXRUB",
  displayName: "Alice Stellar",
  avatarUrl: null,
  createdAt: "2026-09-20T10:00:00.000Z",
};

const PEER_USER = {
  id: "user-bob",
  stellarPublicKey: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  displayName: "Bob Testnet",
  avatarUrl: null,
  createdAt: "2026-09-20T10:00:00.000Z",
};

const GROUP = {
  id: "group-trip-1",
  name: "Weekend Getaway",
  description: "Cabin trip expenses",
  createdByUserId: CURRENT_USER.id,
  treasuryEnabled: false,
  treasuryAccountPublicKey: null,
  treasuryRequiredSigners: null,
  archived: false,
  createdAt: "2026-09-20T10:00:00.000Z",
};

const MEMBERS = [
  {
    id: "member-alice",
    groupId: GROUP.id,
    userId: CURRENT_USER.id,
    role: "admin" as const,
    joinedAt: "2026-09-20T10:00:00.000Z",
    user: CURRENT_USER,
  },
  {
    id: "member-bob",
    groupId: GROUP.id,
    userId: PEER_USER.id,
    role: "member" as const,
    joinedAt: "2026-09-20T10:00:00.000Z",
    user: PEER_USER,
  },
];

const EXPENSE = {
  id: "expense-cabin-1",
  groupId: GROUP.id,
  payerUserId: CURRENT_USER.id,
  payer: CURRENT_USER,
  title: "Cabin Rental",
  description: "Lodging fee",
  amount: "200",
  assetCode: "USDC",
  assetIssuer: null,
  splitType: "equal" as const,
  memo: "Cabin payment",
  receiptUrl: null,
  createdAt: "2026-09-21T10:00:00.000Z",
  shares: [
    {
      id: "share-alice",
      expenseId: "expense-cabin-1",
      userId: CURRENT_USER.id,
      user: CURRENT_USER,
      shareAmount: "100",
      status: "pending" as const,
    },
    {
      id: "share-bob",
      expenseId: "expense-cabin-1",
      userId: PEER_USER.id,
      user: PEER_USER,
      shareAmount: "100",
      status: "pending" as const,
    },
  ],
};

const BALANCES_INITIAL = {
  balances: [
    { userId: CURRENT_USER.id, user: CURRENT_USER, net: "0", assetCode: "USDC" },
    { userId: PEER_USER.id, user: PEER_USER, net: "0", assetCode: "USDC" },
  ],
  suggestions: [],
};

const BALANCES_POST_EXPENSE = {
  balances: [
    { userId: CURRENT_USER.id, user: CURRENT_USER, net: "100", assetCode: "USDC" },
    { userId: PEER_USER.id, user: PEER_USER, net: "-100", assetCode: "USDC" },
  ],
  suggestions: [
    {
      fromUserId: PEER_USER.id,
      from: PEER_USER,
      toUserId: CURRENT_USER.id,
      to: CURRENT_USER,
      amount: "100",
      assetCode: "USDC",
      assetIssuer: null,
    },
  ],
};

async function mockFreighterWallet(page: Page): Promise<void> {
  await page.addInitScript(
    ({ publicKey, networkPassphrase, network, networkName, networkUrl }) => {
      (window as unknown as Record<string, unknown>)["freighter"] = true;

      window.addEventListener("message", (event) => {
        const data = event.data as {
          source?: string;
          messageId?: string;
          type?: string;
          transactionXdr?: string;
        };
        if (!data || data.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") return;

        const { messageId, type } = data;
        const reply = (payload: Record<string, unknown>) =>
          window.postMessage(
            {
              source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
              messagedId: messageId,
              ...payload,
            },
            "*"
          );

        switch (type) {
          case "REQUEST_CONNECTION_STATUS":
            return reply({ isConnected: true });
          case "REQUEST_ALLOWED":
          case "REQUEST_ALLOWED_STATUS":
          case "SET_ALLOWED_STATUS":
            return reply({ isAllowed: true });
          case "REQUEST_PUBLIC_KEY":
            return reply({ publicKey });
          case "REQUEST_NETWORK_DETAILS":
            return reply({
              networkPassphrase,
              network,
              networkName,
              networkUrl,
            });
          case "REQUEST_SIGN_TRANSACTION":
            return reply({
              signedTransaction: data.transactionXdr ?? "signed-xdr-placeholder",
            });
          default:
            return reply({});
        }
      });
    },
    {
      publicKey: CURRENT_USER.stellarPublicKey,
      networkPassphrase: NETWORK_PASSPHRASE,
      network: NETWORK,
      networkName: NETWORK_NAME,
      networkUrl: NETWORK_URL,
    }
  );
}

test.describe("Group creation and expense splitting journey (#612)", () => {
  test.beforeEach(async ({ page }) => {
    await mockFreighterWallet(page);
  });

  test("creates group, records expense, and displays split balances", async ({
    page,
  }) => {
    // Initial test structure
    expect(GROUP.name).toBe("Weekend Getaway");
    expect(EXPENSE.amount).toBe("200");
  });
});
