import { v } from "convex/values";
import { components } from "../_generated/api";
import { internalQuery } from "../_generated/server";

type ExportEntry = {
  query: string;
  expectedAnswer: string;
  rating: "thumbsUp" | "thumbsDown";
  category: string | undefined;
  messageId: string;
};

export const exportGoldenDataset = internalQuery({
  args: {
    maxFeedbackEntries: v.optional(v.number()),
    maxUsers: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ entries: ExportEntry[] }> => {
    const maxFeedback = args.maxFeedbackEntries ?? 100;
    const maxUsers = args.maxUsers ?? 50;

    const feedbackEntries = await ctx.db.query("feedback").order("desc").take(maxFeedback);

    if (feedbackEntries.length === 0) {
      return { entries: [] };
    }

    const targetMessageIds = new Set(feedbackEntries.map((f) => f.messageId));

    const messageInfos = new Map<
      string,
      { text: string; role: string; order: number; threadId: string }
    >();

    const threadMessagesCache = new Map<
      string,
      Array<{ _id: string; text: string; role: string; order: number }>
    >();

    let userCursor = null as string | null;
    let usersDone = false;
    let usersChecked = 0;

    while (!usersDone && usersChecked < maxUsers) {
      const usersPage = await ctx.db.query("users").paginate({ numItems: 20, cursor: userCursor });

      for (const user of usersPage.page) {
        if (usersChecked >= maxUsers) break;
        usersChecked++;
        if (!user.clerkId) continue;

        let threadCursor = null as string | null;
        let threadsDone = false;

        while (!threadsDone) {
          const threadsResult = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
            userId: user.clerkId,
            paginationOpts: { numItems: 20, cursor: threadCursor },
          });

          const activeThreads = threadsResult.page.filter((t) => t.status === "active");
          const messagesResults = await Promise.all(
            activeThreads.map((thread) =>
              ctx
                .runQuery(components.agent.messages.listMessagesByThreadId, {
                  threadId: thread._id,
                  order: "asc",
                  paginationOpts: { numItems: 100, cursor: null },
                })
                .then((result) => ({ thread, result })),
            ),
          );

          for (const { thread, result: messagesResult } of messagesResults) {
            // Cache the paired messages for this thread to avoid repeating queries later
            if (!threadMessagesCache.has(thread._id)) {
              const userMessages = messagesResult.page.filter(
                (m) =>
                  m.message &&
                  typeof m.message === "object" &&
                  "role" in m.message &&
                  String(m.message.role) === "user" &&
                  !m.tool,
              );

              const assistantMessages = messagesResult.page.filter(
                (m) =>
                  m.message &&
                  typeof m.message === "object" &&
                  "role" in m.message &&
                  String(m.message.role) === "assistant" &&
                  !m.tool,
              );

              const paired: Array<{ _id: string; text: string; role: string; order: number }> = [];
              for (let i = 0; i < Math.min(userMessages.length, assistantMessages.length); i++) {
                const userMsg = userMessages[i]!;
                const assistantMsg = assistantMessages[i]!;
                const text: string = typeof userMsg.text === "string" ? userMsg.text : "";
                const answer: string =
                  typeof assistantMsg.text === "string" ? assistantMsg.text : "";

                paired.push({
                  _id: userMsg._id,
                  text,
                  role: "user",
                  order: i,
                });
                paired.push({
                  _id: assistantMsg._id,
                  text: answer,
                  role: "assistant",
                  order: i,
                });
              }

              threadMessagesCache.set(thread._id, paired);
            }

            for (const msg of messagesResult.page) {
              if (targetMessageIds.has(msg._id)) {
                const text =
                  typeof msg.text === "string"
                    ? msg.text
                    : msg.message && typeof msg.message === "object" && "content" in msg.message
                      ? typeof msg.message.content === "string"
                        ? msg.message.content
                        : ""
                      : "";

                const role =
                  msg.message && typeof msg.message === "object" && "role" in msg.message
                    ? String(msg.message.role)
                    : "assistant";

                messageInfos.set(msg._id, {
                  text,
                  role,
                  order: msg.order,
                  threadId: thread._id,
                });
              }
            }

            // Early termination: stop scanning threads once all target messages found
            if (messageInfos.size >= targetMessageIds.size) break;
          }

          if (messageInfos.size >= targetMessageIds.size) break;
          threadsDone = threadsResult.isDone;
          threadCursor = threadsResult.continueCursor as string | null;
        }

        // Early termination: stop scanning users once all target messages found
        if (messageInfos.size >= targetMessageIds.size) break;
      }

      usersDone = usersPage.isDone;
      userCursor = usersPage.continueCursor;
    }

    async function getPairedMessages(
      threadId: string,
      messageId: string,
      currentRole: string,
    ): Promise<{ query: string; answer: string }> {
      const cached = threadMessagesCache.get(threadId) ?? [];
      const msgIndex = cached.findIndex((m) => m._id === messageId);

      if (msgIndex === -1) return { query: "", answer: "" };

      const msg = cached[msgIndex]!;

      if (msg.role === "user") {
        const next = cached[msgIndex + 1];
        return {
          query: msg.text ?? "",
          answer: next?.text ?? "",
        };
      }

      const prev = cached[msgIndex - 1];
      return {
        query: prev?.text ?? "",
        answer: msg.text ?? "",
      };
    }

    const entries: ExportEntry[] = [];

    for (const feedback of feedbackEntries) {
      const msgInfo = messageInfos.get(feedback.messageId);

      if (msgInfo) {
        const { query, answer } = await getPairedMessages(
          msgInfo.threadId,
          feedback.messageId,
          msgInfo.role,
        );

        entries.push({
          query: query || msgInfo.text,
          expectedAnswer: answer,
          rating: feedback.rating,
          category: feedback.category,
          messageId: feedback.messageId,
        });
      } else {
        entries.push({
          query: "",
          expectedAnswer: "",
          rating: feedback.rating,
          category: feedback.category,
          messageId: feedback.messageId,
        });
      }
    }

    return {
      entries: entries.filter((e) => e.query.length > 0),
    };
  },
});
