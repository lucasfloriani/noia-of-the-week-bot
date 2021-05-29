import dotenv from 'dotenv'
import { WebClient } from '@slack/web-api'
import { createEventAdapter } from '@slack/events-api'
import { exit } from 'process'
import * as Task from 'fp-ts/Task';

import { checkEnvVars, getPort } from './helpers/env'
import { getUsersIDsInText, getUserIDByMention } from './helpers/slack'

type UserReactionCounting = {
  [key: string]: number
}

dotenv.config()

if (!checkEnvVars("SLACK_TOKEN", "SLACK_SIGNIN")) {
  exit(1);
}

const web = new WebClient(process.env.SLACK_TOKEN!);
const slackEvents = createEventAdapter(process.env.SLACK_SIGNIN!);

slackEvents.on('app_mention', async (payload) => {
  try {
    console.log("payload:", payload);
    const threadTS = payload.thread_ts;

    const noiaReplies = await web.conversations.replies({
      channel: payload.channel,
      ts: payload.thread_ts,
      limit: 200,
    });

    const messagesWithReactions = noiaReplies.messages?.map(async (message) => {
      const messageReactions = await web.reactions.get({
        channel: payload.channel,
        timestamp: message.ts,
      })
      const usersMentioned = getUsersIDsInText(message.text)

      return { usersMentioned, messageReactions }
    });

    const messagesAndReactions = messagesWithReactions ? await Promise.all(messagesWithReactions) : [];
    const countingOfReactionsPerUser = messagesAndReactions.map((item) => {
      return item.usersMentioned.map(mention => ({
        userID: mention,
        qtyOfReactions: item.messageReactions.message?.reactions?.reduce((acc, reaction) => acc + (reaction.count || 0), 0) ?? 0
      }))
    })

    const allCouting = countingOfReactionsPerUser.flat(1);
    const resultInObj = allCouting.reduce((acc, item) => ({
      ...acc,
      ...({ [item.userID]: acc[item.userID] ? acc[item.userID] + item.qtyOfReactions : item.qtyOfReactions }),
    }), {} as UserReactionCounting);

    const items = Object.entries(resultInObj).sort((a, b) => {
      if (a[1] < b[1]) return 1
      if (a[1] > b[1]) return -1
      return 0;
    })

    const messagesCalls = items.slice(0, 3).map(async (item, index) => {
      const userInfo = await web.users.info({ user: getUserIDByMention(item[0]) });
      return `${index + 1} => ${userInfo.user?.profile?.display_name} (${item[1]} votos)`;
    });

    const messages = await Promise.all(messagesCalls);
    const message = messages.join('\n');

    await web.chat.postMessage({
      channel: payload.channel,
      thread_ts: threadTS!,
      text: message,
    });
  } catch (e) {
    console.error(e);
  }
});

(async () => {
  const server = await slackEvents.start(getPort());
  const serverAddress = server.address();

  if (!serverAddress) return;
  if (typeof serverAddress === 'string') {
    console.log(`Listening for events on ${serverAddress}`);
    return;
  }
  console.log(`Listening for events on ${serverAddress.port}`);
})()
