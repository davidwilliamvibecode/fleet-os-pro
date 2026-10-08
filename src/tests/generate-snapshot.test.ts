import snapshot from "vitest-snapshot";

vitest.suite("fs snapshot", () => {
  vitest.test("root is observable", async () => {
    expect(process.cwd()).toMatchSnapshot(await snapshot());
  });
});
