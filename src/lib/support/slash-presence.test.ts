import { describe, expect, it } from "vitest";
import { filterCannedReplies, findSlashQuery, replaceSlashQuery } from "./slash-command";
import { activeViewers, describeViewers, shortName } from "./presence";

describe("slash command", () => {
  it("finds a slash token at line start or after a space", () => {
    expect(findSlashQuery("/dns", 4)).toEqual({ start: 0, query: "dns" });
    expect(findSlashQuery("Merhaba\n/kar", 12)).toEqual({ start: 8, query: "kar" });
    expect(findSlashQuery("tamam /", 7)).toEqual({ start: 6, query: "" });
    expect(findSlashQuery("/dns yayılımı", 13)).toEqual({ start: 0, query: "dns yayılımı" });
  });

  it("ignores slashes inside words, URLs and finished lines", () => {
    expect(findSlashQuery("1/2", 3)).toBeNull();
    expect(findSlashQuery("https://a.com/x", 15)).toBeNull();
    expect(findSlashQuery("/dns\nyeni", 9)).toBeNull();
    expect(findSlashQuery("/ boşluk", 8)).toBeNull();
    expect(findSlashQuery("metin", 5)).toBeNull();
  });

  it("replaces the token and moves the caret after the insert", () => {
    expect(replaceSlashQuery("Selam /kar sonra", 6, 10, "Merhaba!")).toEqual({ text: "Selam Merhaba! sonra", caret: 14 });
  });

  it("ranks title matches before body matches (tr-TR lower case)", () => {
    const replies = [
      { title: "Karşılama", body: "Merhaba" },
      { title: "DNS yayılımı", body: "İŞLEM 24 saat" },
      { title: "Kapanış", body: "dns sorunu çözüldü" },
    ];
    expect(filterCannedReplies(replies, "dns").map((r) => r.title)).toEqual(["DNS yayılımı", "Kapanış"]);
    expect(filterCannedReplies(replies, "işlem").map((r) => r.title)).toEqual(["DNS yayılımı"]);
    expect(filterCannedReplies(replies, "", 2)).toHaveLength(2);
  });
});

describe("ticket presence", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  const ago = (s: number) => new Date(now.getTime() - s * 1000);

  it("lists other recent viewers, typing first, without self or stale rows", () => {
    const viewers = activeViewers(
      [
        { userId: "me", name: "Ben", lastSeenAt: ago(1), typingAt: ago(1) },
        { userId: "a", name: "Ayşe Y.", lastSeenAt: ago(10), typingAt: null },
        { userId: "c", name: "Can D.", lastSeenAt: ago(5), typingAt: ago(8) },
        { userId: "old", name: "Eski", lastSeenAt: ago(90), typingAt: ago(90) },
        { userId: "t", name: "Tuna", lastSeenAt: ago(5), typingAt: ago(60) },
      ],
      "me",
      now
    );
    expect(viewers).toEqual([
      { userId: "c", name: "Can D.", typing: true },
      { userId: "a", name: "Ayşe Y.", typing: false },
      { userId: "t", name: "Tuna", typing: false },
    ]);
  });

  it("describes viewers in Turkish", () => {
    expect(describeViewers([])).toBeNull();
    expect(describeViewers([{ userId: "a", name: "Ayşe Y.", typing: false }])).toBe("Ayşe Y. bu talebi görüntülüyor");
    expect(
      describeViewers([
        { userId: "c", name: "Can D.", typing: true },
        { userId: "a", name: "Ayşe Y.", typing: false },
      ])
    ).toBe("Can D. bu talebe yanıt yazıyor (1 kişi daha görüntülüyor)");
    expect(
      describeViewers([
        { userId: "a", name: "Ayşe Y.", typing: false },
        { userId: "b", name: "Burak K.", typing: false },
        { userId: "c", name: "Can D.", typing: false },
      ])
    ).toBe("Ayşe Y., Burak K. ve Can D. bu talebi görüntülüyor");
  });

  it("shortens names", () => {
    expect(shortName("İrem", "şahin")).toBe("İrem Ş.");
    expect(shortName("Destek", "")).toBe("Destek");
  });
});
