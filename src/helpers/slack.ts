const regexSlackMention = /<@([UW][A-Za-z0-9]+)>/g;

export const getUsersIDsInText = (text = '') => text.match(regexSlackMention) || []

export const getUserIDByMention = (mention: string) => mention.replace(/[<@>]/g, '');