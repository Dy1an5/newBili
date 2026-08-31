import { readSecret } from './readSecret.mjs';
import {
    DeepSeekResponsesProvider,
} from '../../src/agent/provider/deepseekResponsesProvider.ts';

const testVideo = {
    videoTitle: '《屿》—— 一个关于遗忘与重逢的故事',
    partTitle: '全文',
    durationMs: 1200000,
    cues: [
        // 第一章：信 (0-180s)
        { startMs: 0, endMs: 15000, text: '陈屿收到了一封信。' },
        { startMs: 15000, endMs: 30000, text: '信上没有署名，邮戳是一个他从未去过的小镇名字：青雾镇。' },
        { startMs: 30000, endMs: 45000, text: '信封里只有一张照片。' },
        { startMs: 45000, endMs: 60000, text: '照片上是一个女孩的背影，站在一片灰蓝色的海边。' },
        { startMs: 60000, endMs: 75000, text: '风吹起她的长发。' },
        { startMs: 75000, endMs: 90000, text: '照片背面有一行字，字迹清秀却陌生：' },
        { startMs: 90000, endMs: 105000, text: '"你忘了我。"' },
        { startMs: 105000, endMs: 120000, text: '陈屿盯着那三个字，看了很久。' },
        { startMs: 120000, endMs: 135000, text: '他的记忆像一片被潮水反复冲刷的沙滩。' },
        { startMs: 135000, endMs: 150000, text: '平坦、湿润，却什么痕迹都没有留下。' },
        { startMs: 150000, endMs: 165000, text: '他忘了她？他根本不认识她。' },
        { startMs: 165000, endMs: 180000, text: '他决定去青雾镇。' },

        // 第二章：青雾镇 (180-360s)
        { startMs: 180000, endMs: 195000, text: '青雾镇比陈屿想象中更小。' },
        { startMs: 195000, endMs: 210000, text: '一条主街，两排老旧的骑楼。' },
        { startMs: 210000, endMs: 225000, text: '灰扑扑的墙面长着青苔。' },
        { startMs: 225000, endMs: 240000, text: '镇子靠海，空气里有一股咸腥的潮气。' },
        { startMs: 240000, endMs: 255000, text: '海雾从早到晚都散不开。' },
        { startMs: 255000, endMs: 270000, text: '远处的山和近处的屋顶都被染成一种朦胧的灰蓝色。' },
        { startMs: 270000, endMs: 285000, text: '陈屿租了一间靠海的民宿。' },
        { startMs: 285000, endMs: 300000, text: '房东是个六七十岁的老太太，姓林。' },
        { startMs: 300000, endMs: 315000, text: '她眼神不太好，但耳朵很灵。' },
        { startMs: 315000, endMs: 330000, text: '她打量了陈屿几眼，问："你也是来找人的吧？"' },
        { startMs: 330000, endMs: 345000, text: '陈屿一愣："也？"' },
        { startMs: 345000, endMs: 360000, text: '林老太没有回答，只是递给他一把钥匙。' },

        // 第三章：海岸 (360-540s)
        { startMs: 360000, endMs: 375000, text: '第二天清晨，陈屿沿着海岸线走。' },
        { startMs: 375000, endMs: 390000, text: '青雾镇的海岸多是礁石。' },
        { startMs: 390000, endMs: 405000, text: '黑色的岩石被海水磨得光滑。' },
        { startMs: 405000, endMs: 420000, text: '缝隙里长着牡蛎和藤壶。' },
        { startMs: 420000, endMs: 435000, text: '浪花拍上来又退下去，发出沉闷的声响。' },
        { startMs: 435000, endMs: 450000, text: '他走了大约两公里，忽然停住了。' },
        { startMs: 450000, endMs: 465000, text: '前方有一小片沙滩。' },
        { startMs: 465000, endMs: 480000, text: '粗糙的、混着碎贝壳的沙地。' },
        { startMs: 480000, endMs: 495000, text: '沙滩背后是一面斑驳的石墙。' },
        { startMs: 495000, endMs: 510000, text: '墙上爬满了枯藤。' },
        { startMs: 510000, endMs: 525000, text: '就是这里。照片上的背景，就是这面墙。' },
        { startMs: 525000, endMs: 540000, text: '他在沙滩上坐下，发了很久的呆。' },

        // 第四章：照相馆 (540-720s)
        { startMs: 540000, endMs: 555000, text: '回民宿的路上，他在街角看到一个照相馆。' },
        { startMs: 555000, endMs: 570000, text: '橱窗里摆着一些老照片。' },
        { startMs: 570000, endMs: 585000, text: '黑白、泛黄，都是镇子几十年前的样子。' },
        { startMs: 585000, endMs: 600000, text: '他鬼使神差地推门走了进去。' },
        { startMs: 600000, endMs: 615000, text: '老板是个中年男人，戴着一副圆框眼镜。' },
        { startMs: 615000, endMs: 630000, text: '他正在修一张底片。' },
        { startMs: 630000, endMs: 645000, text: '老板接过照片，看了很久。' },
        { startMs: 645000, endMs: 660000, text: '"这张照片，是我拍的。"' },
        { startMs: 660000, endMs: 675000, text: '陈屿心跳漏了一拍。' },
        { startMs: 675000, endMs: 690000, text: '"大概五年前吧。"' },
        { startMs: 690000, endMs: 705000, text: '"她叫什么名字？"' },
        { startMs: 705000, endMs: 720000, text: '老板摇了摇头："她没有告诉我名字。"' },

        // 第五章：旧物 (720-900s)
        { startMs: 720000, endMs: 735000, text: '陈屿回到民宿，翻遍了自己带来的所有行李。' },
        { startMs: 735000, endMs: 750000, text: '他在背包最底层的一个夹层里，摸到了一个硬硬的东西。' },
        { startMs: 750000, endMs: 765000, text: '是一枚贝壳。' },
        { startMs: 765000, endMs: 780000, text: '巴掌大小，螺旋状。' },
        { startMs: 780000, endMs: 795000, text: '表面被海水磨得光滑，泛着珍珠般的光泽。' },
        { startMs: 795000, endMs: 810000, text: '他不记得自己什么时候捡过这枚贝壳。' },
        { startMs: 810000, endMs: 825000, text: '他拿着贝壳去找林老太。' },
        { startMs: 825000, endMs: 840000, text: '"这是青雾镇的特产，叫回音螺。"' },
        { startMs: 840000, endMs: 855000, text: '"你把它贴在耳边，能听到海的声音。"' },
        { startMs: 855000, endMs: 870000, text: '陈屿把贝壳贴到耳边。' },
        { startMs: 870000, endMs: 885000, text: '一开始，他听到的确实是潮声。' },
        { startMs: 885000, endMs: 900000, text: '但渐渐地，一个女孩的声音浮现出来。' },

        // 第六章：日记 (900-1080s)
        { startMs: 900000, endMs: 915000, text: '林老太叹了口气，拿出一个旧铁盒。' },
        { startMs: 915000, endMs: 930000, text: '里面是一本手写的日记。' },
        { startMs: 930000, endMs: 945000, text: '"这是那个女孩留下的。"' },
        { startMs: 945000, endMs: 960000, text: '陈屿翻开日记。' },
        { startMs: 960000, endMs: 975000, text: '"3月12日。我又做了那个梦。"' },
        { startMs: 975000, endMs: 990000, text: '"梦里有一个背影，走在一条很长的海岸线上。"' },
        { startMs: 990000, endMs: 1005000, text: '"我想叫他，但叫不出他的名字。"' },
        { startMs: 1005000, endMs: 1020000, text: '"3月18日。医生说这叫心因性遗忘。"' },
        { startMs: 1020000, endMs: 1035000, text: '"我选择忘记了一些事情，因为太痛了。"' },
        { startMs: 1035000, endMs: 1050000, text: '"3月25日。我到了青雾镇。"' },
        { startMs: 1050000, endMs: 1065000, text: '"这里的海和梦里一模一样。"' },
        { startMs: 1065000, endMs: 1080000, text: '"4月2日。我把日记留给民宿的阿姨。"' },

        // 第七章：遗忘的尽头 (1080-1260s)
        { startMs: 1080000, endMs: 1095000, text: '那天晚上，陈屿没有睡。' },
        { startMs: 1095000, endMs: 1110000, text: '他坐在窗边，看着灰蓝色的海。' },
        { startMs: 1110000, endMs: 1125000, text: '他把回音螺贴在耳边，一遍又一遍地听。' },
        { startMs: 1125000, endMs: 1140000, text: '他想不起来。他真的想不起来。' },
        { startMs: 1140000, endMs: 1155000, text: '她的脸，她的名字，他们之间发生过什么。' },
        { startMs: 1155000, endMs: 1170000, text: '但有些东西不需要想起来的。' },
        { startMs: 1170000, endMs: 1185000, text: '身体记得，心记得。' },
        { startMs: 1185000, endMs: 1200000, text: '他记得那种空缺。那种像被挖走了一块的空洞感。' },
        { startMs: 1200000, endMs: 1215000, text: '他这些年一直以为那是孤独。' },
        { startMs: 1215000, endMs: 1230000, text: '但原来不是。原来他是在找一个人。' },
        { startMs: 1230000, endMs: 1245000, text: '第二天，陈屿去了镇上的派出所。' },
        { startMs: 1245000, endMs: 1260000, text: '他在布告栏最角落里看到一张泛黄的寻人启事。' },

        // 第八章：重逢 (1260-1440s)
        { startMs: 1260000, endMs: 1275000, text: '她叫苏晚。' },
        { startMs: 1275000, endMs: 1290000, text: '他们曾经是恋人。' },
        { startMs: 1290000, endMs: 1305000, text: '五年前，他们一起骑车去海边旅行。' },
        { startMs: 1305000, endMs: 1320000, text: '在盘山公路上出了车祸。' },
        { startMs: 1320000, endMs: 1335000, text: '他撞到了头，昏迷了三天。' },
        { startMs: 1335000, endMs: 1350000, text: '醒来后，他什么都不记得了。' },
        { startMs: 1350000, endMs: 1365000, text: '苏晚陪在他身边，一遍一遍地讲他们以前的事。' },
        { startMs: 1365000, endMs: 1380000, text: '他听着，像听别人的故事。' },
        { startMs: 1380000, endMs: 1395000, text: '"对不起，我真的不记得了。"' },
        { startMs: 1395000, endMs: 1410000, text: '有一天，苏晚走了。没有告别，没有留言。' },
        { startMs: 1410000, endMs: 1425000, text: '但现在他知道了。苏晚去了青雾镇。' },
        { startMs: 1425000, endMs: 1440000, text: '因为那是他们约定要一起去的地方。' },

        // 第九章：尾声 (1440-1600s)
        { startMs: 1440000, endMs: 1455000, text: '陈屿拨通了寻人启事上的号码。' },
        { startMs: 1455000, endMs: 1470000, text: '"喂？请问您是苏晚的母亲吗？"' },
        { startMs: 1470000, endMs: 1485000, text: '电话那头沉默了。' },
        { startMs: 1485000, endMs: 1500000, text: '"小晚她一直在等你。"' },
        { startMs: 1500000, endMs: 1515000, text: '"她走之前说，如果有一天你打电话来——"' },
        { startMs: 1515000, endMs: 1530000, text: '"——告诉你，她找到你了。"' },
        { startMs: 1530000, endMs: 1545000, text: '陈屿握着回音螺，终于放声大哭。' },
        { startMs: 1545000, endMs: 1560000, text: '他忘了她。她忘了他。' },
        { startMs: 1560000, endMs: 1575000, text: '他们隔着五年的空白，在同一个镇子、同一片海岸重逢。' },
        { startMs: 1575000, endMs: 1590000, text: '遗忘的尽头，是重逢。' },
        { startMs: 1590000, endMs: 1600000, text: '灰蓝色的海雾慢慢散去，海平线上露出一线金色的阳光。' },
    ],
};

async function main() {
    let apiKey = '';

    try {
        apiKey = await readSecret('请输入DeepSeek API key:');

        if (!apiKey.trim()) {
            throw new Error('API key不能为空');
        }

        const provider = new DeepSeekResponsesProvider({
            reasoningEffort: 'high',
        });

        console.log('正在生成模拟视频总结...');

        const response = await provider.complete(
            {
                modelId: 'deepseek-v4-flash',
                messages: [
                    {
                        role: 'system',
                        content: [
                            '你是一个严谨的视频字幕总结助手.',
                            '只能依据提供的字幕总结.',
                            '不能补充字幕中没有出现的事实.',
                            '使用中文输出简短总结.',
                            '重要观点需要标注对应的毫秒时间范围.',
                        ].join('\n'),
                    },
                    {
                        role: 'user',
                        content: [
                            '请总结下面的视频字幕.',
                            JSON.stringify(testVideo, null, 2),
                        ].join('\n\n'),
                    },
                ],
                maxOutputTokens: 1024,
            },
            apiKey,
        );

        console.log('\n总结结果:');
        console.log(response.text);

        if (response.usage) {
            console.log('\nToken用量:');
            console.log({
                inputTokens: response.usage.inputTokens,
                outputTokens: response.usage.outputTokens,
            });
        }
    } finally {
        apiKey = '';
    }
}

main().catch((error) => {
    const message = error instanceof Error
        ? error.message
        : '发生未知错误';

    console.error('\n总结失败:');
    console.error(message);
    process.exitCode = 1;
});