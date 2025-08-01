import plugin from '../../../lib/plugins/plugin.js'
import Save from '../model/class/Save.js'
import fCompute from '../model/fCompute.js'
import getInfo from '../model/getInfo.js'
import getRksRank from '../model/getRksRank.js'
import getSave from '../model/getSave.js'
import send from '../model/send.js'
import picmodle from '../model/picmodle.js'
import Config from '../components/Config.js'
import getNotes from '../model/getNotes.js'
import PhigrosUser from '../lib/PhigrosUser.js'
import getBanGroup from '../model/getBanGroup.js';
import makeRequest from '../model/makeRequest.js'
import makeRequestFnc from '../model/makeRequestFnc.js'
import saveHistory from '../model/class/saveHistory.js'

export class phiRankList extends plugin {

    constructor() {
        super({
            name: 'phi-rankList',
            event: 'message',
            priority: 1000,
            dsc: 'phigros rks 排行榜',
            rule: [
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(排行榜|ranklist).*$`,
                    fnc: 'rankList'
                },
                {
                    reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(查询排名|rankfind).*$`,
                    fnc: 'rankfind'
                }
                // {
                //     reg: `^[#/](${Config.getUserCfg('config', 'cmdhead')})(\\s*)(封神榜|godlist)$`,
                //     fnc: 'godList'
                // }
            ]

        })
    }

    async rankList(e) {

        if (await getBanGroup.get(e, 'rankList')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }



        if (Config.getUserCfg('config', 'openPhiPluginApi')) {
            try {
                let data = {
                    Title: "RankingScore排行榜",
                    totDataNum: 0,
                    BotNick: Bot.nickname,
                    users: [],
                    me: {},
                }
                /**请求的排名 */
                let msg = e.msg.match(/\d+/)
                let api_ranklist = null
                if (msg) {
                    api_ranklist = await makeRequest.getRanklistRank({ request_rank: Number(msg[0]) })
                } else {
                    api_ranklist = await makeRequest.getRanklistUser(makeRequestFnc.makePlatform(e))
                }
                data.totDataNum = api_ranklist.totDataNum;
                for (let item of api_ranklist.users) {
                    data.users.push({ ...await makeSmallLine(item), index: item.index, me: item.me })
                }
                data.me = await makeLargeLine(new Save(api_ranklist.me.save), new saveHistory(api_ranklist.me.history))
                send.send_with_At(e, [`总数据量：${data.totDataNum}\n`, await picmodle.common(e, 'rankingList', data)])
                return true
            } catch (err) {
                logger.warn(`[phi-plugin] API ERR`, err)
            }
        }
        let data = {
            Title: "RankingScore排行榜",
            totDataNum: 0,
            BotNick: Bot.nickname,
            users: [],
            me: {},
        }
        /**请求的排名 */
        let msg = e.msg.match(/\d+/)
        let rankNum = 0
        data.totDataNum = await getRksRank.getAllRank()

        if (msg) {
            rankNum = Math.max(Math.min(msg[0], data.totDataNum), 1) - 1
        } else {
            let save = await send.getsave_result(e)
            if (!save) {
                return true
            }
            let sessionToken = save.getSessionToken()
            rankNum = await getRksRank.getUserRank(sessionToken)
        }

        /**展示的用户数据 */
        let list = []
        let myTk = ''
        if (rankNum < 2) {
            list = await getRksRank.getRankUser(0, 5)
            myTk = list[rankNum]
        } else {
            list = await getRksRank.getRankUser(rankNum - 2, rankNum + 3)
            myTk = list[2]
        }


        for (let index = 0; index < Math.max(list.length, 5); index++) {
            if (index >= list.length) {
                data.users.push({ playerId: '无效用户', index: index + rankNum - 2 })
                continue
            }
            let item = list[index]
            let sessionToken = item
            let save = await getSave.getSaveBySessionToken(sessionToken)
            if (!save) {
                data.users.push({ playerId: '无效用户', index: index + rankNum - 2 })
                getRksRank.delUserRks(sessionToken)
            } else {
                data.users.push({ ...await makeSmallLine(save), index: Math.max(index + rankNum - 1, index + 1), me: myTk === save.getSessionToken() })
            }
            if (myTk === sessionToken) {
                let history = await getSave.getHistoryBySessionToken(save.getSessionToken())
                data.me = await makeLargeLine(save, history)
            }
        }

        send.send_with_At(e, [`总数据量：${data.totDataNum}\n`, await picmodle.common(e, 'rankingList', data)])
    }

    async rankfind(e) {
        if (await getBanGroup.get(e, 'rankList')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let rks = Number(e.msg.replace(/^[#/]?.*?rankfind/, '').match(/\d+(.\d+)?/)?.[0])
        if (!rks) {
            send.send_with_At(e, `请输入要查询的 rks！\n格式： /${Config.getUserCfg('config', 'cmdhead')} rankfind <rks>`)
            return false
        }

        if (Config.getUserCfg('config', 'openPhiPluginApi')) {
            try {
                makeRequest.getRanklistRks({ request_rks: rks }).then((res) => {
                    send.send_with_At(e, `当前服务器记录中一共有 ${res.rksRank}/${res.totNum} 位玩家的 rks 大于 ${rks}！`)
                })
                return true
            } catch (err) {
                logger.warn(`[phi-plugin] API ERR`, err)
            }
        }

        let totDataNum = await getRksRank.getAllRank()

        let rank = await getRksRank.getRankByRks(rks)

        send.send_with_At(e, `当前服务器记录中一共有 ${rank}/${totDataNum} 位玩家的 rks 大于 ${rks}！`)

        return true
    }

    async godList(e) {

        if (await getBanGroup.get(e, 'godList')) {
            send.send_with_At(e, '这里被管理员禁止使用这个功能了呐QAQ！')
            return false
        }

        let list = await getSave.getGod()
        let plugin_data = await getNotes.getPluginData(e.user_id)
        let data = {
            Title: "封神榜",
            totDataNum: 0,
            BotNick: Bot.nickname,
            users: [],
            background: getInfo.getill(getInfo.illlist[Number((Math.random() * (getInfo.illlist.length - 1)).toFixed(0))], 'blur'),
            theme: plugin_data?.plugin_data?.theme || 'star',
        }

        if (!list) {
            data.totDataNum = 0
            send.send_with_At(e, await picmodle.common(e, 'rankingList', data))
            return true
        }

        data.totDataNum = list.length

        for (let i = 0; i < list.length; i++) {
            try {
                let godRecord = new PhigrosUser(list[i].match(/[a-zA-Z0-9]{25}/)[0])
                await godRecord.buildRecord()
                let god = new Save(godRecord, true)
                await god.init()
                data.users.push(await makeLargeLine(god))
                data.users[data.users.length].index = i
            } catch (e) { }
        }
        send.send_with_At(e, await picmodle.common(e, 'rankingList', data))
    }
}

/**
 * 创建一个详细对象
 * @param {Save} save 
 */
async function makeLargeLine(save, history) {
    if (!save) {
        return {
            playerId: "无效用户"
        }
    }


    let lineData = history.getRksAndDataLine()
    lineData.rks_date.forEach((item, index) => {
        item = fCompute.formatDateToNow(item)
        lineData.rks_date[index] = item
    });
    let clgHistory = []
    history.challengeModeRank.forEach((item, index, array) => {
        if (!index || item.value != array[index - 1].value) {
            clgHistory.push({
                ChallengeMode: Math.floor(item.value / 100),
                ChallengeModeRank: item.value % 100,
                date: fCompute.formatDateToNow(item.date)
            })
        }
    })
    let b30Data = await save.getB19(33)
    let b30list = {
        P3: {
            title: 'Perfect 3',
            list: b30Data.phi
        },
        B3: {
            title: 'Best 3',
            list: b30Data.b19_list.slice(0, 3)
        },
        F3: {
            title: 'Floor 3',
            list: b30Data.b19_list.slice(24, 27)
        },
        L3: {
            title: 'Overflow 3',
            list: b30Data.b19_list.slice(27, 30)
        }
    }
    return {
        backgroundurl: getInfo.getBackground(save?.gameuser?.background),
        avatar: getInfo.idgetavatar(save.saveInfo.summary.avatar) || 'Introduction',
        playerId: fCompute.convertRichText(save.saveInfo.PlayerId),
        rks: save.saveInfo.summary.rankingScore || 0,
        ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
        ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
        updated: fCompute.formatDate(save.saveInfo.modifiedAt.iso),
        selfIntro: fCompute.convertRichText(save?.gameuser?.selfIntro),
        rks_history: lineData.rks_history,
        rks_range: lineData.rks_range,
        rks_date: lineData.rks_date,
        b30list: b30list,
        clg_list: clgHistory,
    }
}

/**
 * 创建一个简略对象
 * @param {Save} save 
 */
async function makeSmallLine(save) {
    if (!save) {
        return {
            playerId: "无效用户"
        }
    }
    return {
        backgroundurl: getInfo.getBackground(save?.gameuser?.background),
        avatar: getInfo.idgetavatar(save.saveInfo.summary.avatar) || 'Introduction',
        playerId: fCompute.convertRichText(save.saveInfo.PlayerId),
        rks: save.saveInfo.summary.rankingScore,
        ChallengeMode: Math.floor(save.saveInfo.summary.challengeModeRank / 100),
        ChallengeModeRank: save.saveInfo.summary.challengeModeRank % 100,
    }
}