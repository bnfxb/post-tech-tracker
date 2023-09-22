import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const Delay = async (ms) => new Promise(resolve => setTimeout(resolve, ms));

const botToken = ''; // your tg bot token
const chatId = ''; // tg chat id where to send hooks

const ptAuthToken = ""; // Post tech authorization header value
const ftAuthToken = ""; // Friend tech authorization header value
const minFollowers = 1000; // min twitter followers of the target
const minFTKeyPrice = 0.01; // mint ft key price of the target
const monitorDelay = 500; // milliseconds
const sentUsers = [];

// Twitter
const twBearer = ""; // twitter bearer
const twCookies = ``; //your account tw cookies
const twCsrf = ""; // your account tw csrf token

// proxies, add/change
const agents = [
    new HttpsProxyAgent("http://username:password@ip:port"),
    new HttpsProxyAgent("http://ip:port")
];

async function sendMessage(message) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                disable_web_page_preview: true,
                parse_mode: "Markdown"
            }),
            agent: agents[Math.floor(Math.random() * agents.length)]
        });

    } catch (error) {
        console.error("Failed to send webhook:", error);
    }
}

async function getFollowersCount(agent, username) {
    return await fetch(`https://twitter.com/i/api/graphql/G3KGOASz96M-Qu0nwmGXNg/UserByScreenName?variables=%7B%22screen_name%22%3A%22${username}%22%2C%22withSafetyModeUserFields%22%3Atrue%7D&features=%7B%22hidden_profile_likes_enabled%22%3Atrue%2C%22hidden_profile_subscriptions_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22subscriptions_verification_info_is_identity_verified_enabled%22%3Atrue%2C%22subscriptions_verification_info_verified_since_enabled%22%3Atrue%2C%22highlights_tweets_tab_ui_enabled%22%3Atrue%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%7D&fieldToggles=%7B%22withAuxiliaryUserLabels%22%3Afalse%7D`, {
        "headers": {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "authorization": twBearer,
            "x-csrf-token": twCsrf,
            "x-twitter-active-user": "yes",
            "x-twitter-client-language": "en",
            "cookie": twCookies,
            agent: agent
        },
        "body": null,
        "method": "GET"
    })
        .then(r => {
            console.log("Twitter:", r.status)
            return r.json()
        })
        .then(d => {
            return d.data.user.result.legacy.followers_count
        })
}

async function sMonitor() {
    let lastUserID = '';
    
    for (; ;) {

        try {

            await fetch("https://api.post.tech/wallet-post/wallet/get-recent-action", {
                "headers": {
                    "accept": "application/json, text/plain, */*",
                    "accept-language": "en-US,en;q=0.9",
                    "authorization": ptAuthToken,
                    "Referer": "https://post.tech/",
                    "Referrer-Policy": "strict-origin-when-cross-origin"
                },
                "body": null,
                "method": "GET",
                agent: agents[Math.floor(Math.random() * agents.length)]
            })
                .then(r => {
                    return r.text()
                })
                .then(async data => {
                    const jsonData = JSON.parse(data)
                    const recentTrades = jsonData.data

                    if (!recentTrades) {
                        console.log("Bad data:", recentTrades)
                        return
                    }

                    if (recentTrades[0].trader.user_id == lastUserID || recentTrades[0].trader.userId == lastUserID)
                        return;

                    for (let i = 0; i < 150; i++) {
                        const act = recentTrades[i]

                        if (!act.trader.user_id) {
                            act.trader.user_id = act.trader.userId
                            act.subject.user_id = act.subject.userId
                            act.tx_hash = act.txHash
                            act.trader.user_name = act.trader.userName
                            act.subject.user_name = act.subject.userName
                        }

                        if (!lastUserID) {
                            lastUserID = act.trader.user_id
                            return
                        }

                        if (act.trader.user_id == lastUserID)
                            return;

                        if (act.trader.user_id == act.subject.user_id && act.action == 'buy' && act.value == 0) {

                            const followers = await getFollowersCount(agents[Math.floor(Math.random() * agents.length)], act.subject.user_name)

                            console.log("User: ", act.trader.user_name, followers)

                            if (sentUsers.includes(act.trader.user_name))
                                return;
                            else
                                sentMsgs.push(act.trader.user_name)

                            const ftUserWallet = await fetch(`https://prod-api.kosetto.com/search/users?username=${act.trader.user_name}`, {
                                "headers": {
                                    "accept": "application/json",
                                    "authorization": ftAuthToken,
                                    "content-type": "application/json",
                                    "Referer": "https://www.friend.tech/",
                                    "Referrer-Policy": "strict-origin-when-cross-origin"
                                },
                                "body": null,
                                "method": "GET"
                            })
                                .then(r => r.json())
                                .then(async d => {
                                    const addr = d.users[0].address
                                    const ftUser = await fetch(`https://prod-api.kosetto.com/users/${addr}`, {
                                        "headers": {
                                            "Referer": "https://www.friend.tech/",
                                            "Referrer-Policy": "strict-origin-when-cross-origin"
                                        },
                                        "body": null,
                                        "method": "GET"
                                    }).catch(err => {
                                        console.log("Failed to get ft user", err)
                                    })
                                        .then(r => r.json())
                                        .catch(err => console.log(err))

                                    return ftUser
                                })
                                .catch(err => console.log(err))

                            let ftKey = undefined;
                            if (ftUserWallet) {
                                try {
                                    ftKey = ethers.utils.formatEther(ftUserWallet.displayPrice)
                                } catch (err) {
                                    console.log("Failed to get ft key price:", err);
                                }
                            }

                            if (followers >= minFollowers && ftKey >= minFTKeyPrice) {
                                sendMessage(`**New user:** twitter.com/${act.trader.user_name}\n\n**Followers:** ${followers}\n**FT KeyPrice:** ${ftKey}\n\n**PostTech Buy URL:** https://post.tech/buy-sell/${act.trader.user_id}`)
                            
                            }

                        }
                    }

                    lastUserID = recentTrades[0].trader.user_id || recentTrades[0].trader.userId
                })
                .catch(err => {
                    console.log("ERROR actions:", err)
                })

        } catch (err) {
            console.log("Failed to monitor", err);
        }

        await Delay(monitorDelay);
    }
}

(async () => {
    await sMonitor();
})();
