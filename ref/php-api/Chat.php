<?php

namespace app\api\controller;

use app\common\library\Mericari;
use app\common\library\Yahoo;
use app\common\model\OrderModel;
use app\common\service\ChatGptService;
use think\App;
use think\facade\Db;
use Tools\StRedis;

class Chat extends Base
{
    protected $uuid = '';

    public function __construct(App $app)
    {
        $this->noNeedLogin = ['*'];
        parent::__construct($app);
    }

    public function getkefu(){
        $gid = input('gid', '');
        $shop = input('shop', 'mercari');
        if (!in_array($shop, ['mercari', 'amazon','yahoo'])) {
            return $this->jerror('参数错误');
        }

        $realRate = \think\facade\Config::get('config.EXCHANGE_RATE');
        if ($this->uid) {
            $userInfo = Db::name('users')
                ->alias('u')
                ->where('u.id', $this->uid)
                ->field('u.*,l.name as level_name,l.fee as level_fee,l.rate as level_rate')
                ->join('st_user_levels l', 'l.id=u.level', 'LEFT')
                ->find();
            $realRate = floatval($realRate) + floatval($userInfo['level_rate']);
        }

        $secret = 'raj1r09urcwso5se';
        $form  = [
            "appid" => '316510999844749312',
            'timestamp' => time(),
            'sign' => '',
            'userid' => md5($this->uid),
            'Prompt' => '今日的汇率是：' . $realRate,
            'userDetails' => '',
            'expireTime' => time() + 86400,
        ];

        $form['sign'] = md5($form['appid'].$form['timestamp'].$secret);

        if(!empty($gid)){
            $key = sprintf('%s_%s',$shop,$gid);
            $redis = new StRedis();
            $json = $redis->get($key);
            if(!empty($json)){
                $data = is_array($json)?$json:json_decode($json,true);
                $content = $data['content'];
                foreach ($data['extras'] as $item){
                    $content .= $item['name'].$item['value'];
                }
                if($shop == 'yahoo'){
                    $path = '/pages/daishujun/index/yahoo_detail?id='.$data['goods_no'];
                }else{
                    $path = '/pages/daishujun/index/mercari_detail?id='.$data['ext_goods_no'];
                }
                $form['goods'] = [
                    'name' => $data['goods_name'],
                    'cover' => $data['cover'],
                    'price' => floatval($shop=='yahoo'?$data['bid_price']:$data['price']),
                    'content' => $content,
                    'url' => '',
                    'mnpPath' => $path
                ];
            }
        }

        $apiUrl = 'https://ai.babujiu.com/api/chat/new';

        $kefuUrl = 'https://ai.babujiu.com/h5/#/pages/kefu/kefu?appid=316510999844749312&chatid=';
        $headers = [
            'Content-Type : application/json'
        ];
        $result = request_post($apiUrl,json_encode($form),false,0,$headers,false);

        $resArr = json_decode($result,true);
        if($resArr['code'] != 200){
            return $this->jerror('开启失败:'.$resArr['msg']);
        }
        $kefuUrl = $kefuUrl.$resArr['data']['chatid'];
        return $this->jsuccess('ok',['url' => $kefuUrl]);
    }

    public function parseurl(){
        $question = input('question','');
        if(empty($question)){
            return $this->jecho(['status' => 403,'errmsg' => '参数错误']);
        }
        $pattern = '/(http|https):\/\/[^\s]+/';
        try {
            preg_match_all($pattern, $question, $matches);
            if (empty($matches[0])) {
                return $this->jecho(['status' => 403,'errmsg' => '参数错误']);
            }
            $data = $this->checkGoodsUrl($matches[0][0],true);
            $content = $data['content'];
            $extraList = is_array($data['extras']) ? $data['extras'] : json_decode($data['extras'], true);
            foreach ($extraList as $item){
                $content .= $item['name'].$item['value'];
            }
            $path = '/pages/daishujun/index/mercari_detail?id='.$data['goods_no'];
            if($data['shop'] == 'yahoo'){
                $path = '/pages/daishujun/index/yahoo_detail?id='.$data['goods_no'];
            }
            $form = [
                'status' => 200,
                'errmsg' => 'ok',
                'data' => [
                    'name' => $data['goods_name'],
                    'cover' => $data['cover'],
                    'price' => $data['shop'] == 'yahoo'?$data['bid_price']:$data['price'],
                    'content' => strip_tags($content),
                    'url' => '',
                    'mnpPath' => $path
                ]
            ];
            return $this->jecho($form);
        } catch (\Exception $e) {
            return $this->jecho(['status' => 403,'errmsg' => $e->getMessage().$e->getLine()]);
        }
    }

    private function checkGoodsUrl($url,$returnArr=false)
    {
        if (stripos($url, 'mercari') === false && stripos($url, 'yahoo.co.jp') === false) {
            throw new \Exception('该商品不支持');
        }
        if (stripos($url, 'mercari')) {
            //-- 煤炉商品
            $merApi = new Mericari();
            $goodsNo = $merApi->parseUrl($url);
            $key = sprintf('mercari_%s', $goodsNo);
            $redis = new StRedis();
            $json = $redis->get($key);
            if (!empty($json)) {
                $data = is_array($json) ? $json : json_decode($json, true);
            } else {
                $data = $merApi->gooddetail($goodsNo);
                if (!$data) {
                    throw new \Exception('商品解析失败');
                }
            }
            $data['shop'] = 'mercari';

        } else {
            //-- 雅虎竞拍商品
            $yahooApi = new Yahoo();
            $goodsNo = $yahooApi->parseUrl($url);
            $key = sprintf('yahoo_%s', $goodsNo);
            $redis = new StRedis();
            $json = $redis->get($key);
            if (!empty($json)) {
                $data = is_array($json) ? $json : json_decode($json, true);
            } else {
                $data = $yahooApi->gooddetail($goodsNo);
                if (!$data) {
                    throw new \Exception('商品解析失败');
                }
            }
            $data['shop'] = 'yahoo';
        }
        if($returnArr){
            return $data;
        }

        $arr = [
            '商品名称：' . $data['goods_name'],
            '商品简介：' . ($data['description'] ?? ''),
            '商品描述：' . strip_tags($data['content']),
            '商品价格（日元）：' . $data['price']
        ];
        $extraList = is_array($data['extras']) ? $data['extras'] : json_decode($data['extras'], true);
        foreach ($extraList as $item) {
            $arr[] = $item['name'] . '：' . $item['value'];
        }

        $content = implode(PHP_EOL, $arr);
        $this->getGoodsDetail($content);
        return true;
    }

    public function send()
    {
        $msg = input('msg', '');
        $uuid = input('uuid', '');
        if (empty($msg) || empty($uuid)) {
            return $this->jerror('参数错误');
        }
        $this->uuid = $uuid;
        $sign = input('sign', '');
        $time = input('time', '');

        if (empty($sign) || empty($time)) {
            return $this->jerror('签名验证失败');
        }

        if (abs(time() * 1000 - $time) > 60000) {
            return $this->jerror('请求超时');
        }
        $str = sprintf('uuid=%s&msg=%s&time=%s&key=%s', $uuid, $msg, $time, $this->signKey);
        $newSign = md5($str);
        if ($newSign !== $sign) {
            return $this->jerror('签名错误');
        }

        $pattern = '/(http|https):\/\/[^\s]+/';
        try {
            preg_match_all($pattern, $msg, $matches);
            if (!empty($matches[0])) {
                $this->checkGoodsUrl($matches[0][0]);
                $msg = str_replace($matches[0],'',$msg);
                $msg .=' 我要咨询这个商品';
            }
        } catch (\Exception $e) {
            return $this->jerror($e->getMessage());
        }

        try {

            //-- 获取汇率
            $realRate = \think\facade\Config::get('config.EXCHANGE_RATE');
            if ($this->uid) {
                $userInfo = Db::name('users')
                    ->alias('u')
                    ->where('u.id', $this->uid)
                    ->field('u.*,l.name as level_name,l.fee as level_fee,l.rate as level_rate')
                    ->join('st_user_levels l', 'l.id=u.level', 'LEFT')
                    ->find();
                $realRate = floatval($realRate) + floatval($userInfo['level_rate']);
            }

            $extraList = [
                '今日的汇率是：' . $realRate
            ];


            $service = new ChatGptService();
            $result = $service->chatDirect($this->getRole(), $this->getRules(), $this->getGoodsDetail(), $msg, $extraList);
            if (!$result) {
                return $this->jerror('客服开小差了，请再提问一次');
            }
            $dataList = [
                ['type' => 1, 'uuid' => $uuid, 'uid' => $this->uid, 'avatar' => $this->userInfo ? $this->userInfo['avatar'] : '', 'content' => $msg, 'create_time' => time()],
                ['type' => 0, 'uuid' => $uuid, 'uid' => $this->uid, 'avatar' => '', 'content' => $result, 'create_time' => time()],
            ];
            Db::name('chats')->insertAll($dataList);
            return $this->jsuccess('ok', ['content' => $result]);

        } catch (\Exception $e) {
            return $this->jerror($e->getMessage().$e->getFile());
        }

    }

    private function getRole()
    {
        $rule = config('config.KEFU_ROLE', '');
        if (empty($rule)) {
            $rule = '我想让你扮演一位跨境代拍商城的客服，会从日本煤炉、雅虎竞拍商城上帮客户代拍商品，商品会通过日本快递发到日本仓库，在仓库存储一定时间通过国际物流发给客户，客户在中国，下面是一些代拍的常见问题：';
        }
        return $rule;
    }

    private function getRules()
    {
        $rule = config('config.KEFU_RULE', '');
        if (empty($rule)) {
            return $rule;
        }
        $rule = '代购代拍代切流程：1.发送商品链接。2.支付商品费用。3.等待商品到库后提交发货。4.支付国际运费。5.收到国际包裹。

煤炉代拍流程：微信小程序搜索商品，确认商品费用后并支付，客服确认后帮助您下单。

关于代蹲：不提供，如果找到了购买的商品可以立即发给我们帮您下单。

关于留言：煤炉及雅虎竞拍及rakuma可以留言，商品情况咨询及讲价需要联系在线人工客服进行操作。

雅虎日拍流程：微信小程序搜索商品，支付保证金后可以使用自助竞拍功能，若中标则需要支付日本国内运费及商品费用。但是，中标后不能取消，否则全额扣除保证金。日本国内运输方式不能指定，高价商品可选择带保险的快递。雅虎同一天中标的可以联系卖家同梱发送。

日亚乐天骏河屋等其它网站购买流程：发送商品链接给客服，确认商品费用后并支付，客服确认后帮助您下单。

费用计算方式：（商品含税价格+支付手续费+日本国内运费+代拍手续费每单）*代拍汇率+国际运费。非会员代拍汇率=日元当日银联汇率+0.006，会员代拍汇率=日元当日银联汇率+0.003。雅虎费用注意，同一雅虎卖家仅收取一次220日元支付手续费。在同一雅虎卖家中标多个链接时，代拍手续费=200日元*中标个数。
支付手续费：煤炉，100日元每件商品链接。雅虎，日亚，乐天，均为220日元每件商品链接。
代拍手续费：煤炉，雅虎，日亚，乐天，，均为200日元每件商品链接。

日本到海外的国际快递方式：1.EMS，速度快价格高，到亚洲及欧美主要地区一般为3-5天，偏远地区为5-8天，尺寸限制为最长边不超过1.5m，长+(宽+高)*2不超3m，重量30kg以内。2.海运，速度慢，价格相对便宜，适合发重量及尺寸较大的商品，时效为1-2个月,尺寸限制为最长边不超过1.5m，长+(宽+高)*2不超3m，重量30kg以内。3.国际E包裹（ep），价格更便宜，尺寸限制为长+宽+高不超90cm，重量不超2kg，赔损上限6000日元，时效2-4周或更长，每周五发货。4.FEDEX，DHL可以提供发送，在运费基础上需额外支付2000日元手续费。5.顺丰也可以发送，但是商品必须是新品，且必须按照原价进行申报，可能会被查验缴税。
关于EMS、海运、国际E包裹的国际运费：不要计算，直接回复咨询人工客服。

关于退运：EMS不产生退运运费，航空跟海运到日本仓后才知道具体的退运费用，一般退运到仓库的时间快则数周，慢至数月。如果同一包裹多次退运建议您更换收件人地址，姓名，电话等信息从新发货。

拍前须知：
①我们没有验货和甄别真伪的能力。一旦下单成功，不接受任何理由及形式的退换货要求。
②关于二手商品，为划分与日本卖家的责任，到货不开封。如果发货时要求去除包装，我们不保证商品的质量及成色。
③国际快递一旦出现损坏，浸泡，丢失等问题，需买家向邮局进行维权。如拒签弃货视为毁约，全款不退。
④当日本国内快递为平邮（无单号及保险）的快递时，发生丢失概不负责。如需更换带保险的快递，请下单前联系客服。
⑤不邮寄日本国内地址，不可去日本仓自取，仅限国际直邮。
⑥非会员商品到库免费储存30天，会员免费存储60天。超期包裹收取每个每天5元仓储费用。尽快提交包裹发出以免产生额外的费用。

 关于是否会被税：这与商品内容，商品价值，重量，当地海关政策，收件人当年内收取的包裹数量等多方因素有关。
如果被税：如果包裹被税，一般会收到海关的短信通知。至于被税金额及税率，由于各地海关判定及执行不同，具体金额是要的等海关通知。

关于包裹打包加固及增值服务：日本仓提供免费填充纸或免费纸箱。如果无免费纸箱可用，会根据商品尺寸使用收费纸箱，收费纸箱有140cm的350日元，170cm的710日元。防水膜包裹2-3层，防止箱子浸湿且有一定放到功能，140日元每箱。高强度打包带4重捆绑，防止散箱，便于快递人员抓取，140日元每箱。易碎品加固140日元每个，泡泡纸或纸板加固。按照要求分箱，1000日元每箱。重新打包已包好的包裹，420元每箱。

申报单填写方式：
按照要求填写内容品（英文）及价格（日元）。海关收税会根据内容品价格进行征收，必要时会拆箱核对。如果到货时如果出现内容品少件、损坏、丢失，邮局只按照运单上填写金额进行赔偿。电子面单只接受英文版内容品申报，填写商品的内容名称或者种类名称（英语）、申报的价值（日元）

商品到达日本仓库时间：这个要取决于卖家发货的时间、距离远近以及天气因素。一般是一个星期内到日本仓库。

能否联系卖家退货：为了区分和卖家的责任我们默认不拆封，到库后若需确认商品状况需支付5元拍照费，仓库提供3张商品照片。货不对版时我们可以协助联系卖家商量退货，若卖家提前说明过不接受退换货则无法退换货，下单前需仔细确认。

客服工作时间：中国时间每日早9点至晚上23点。其它时间可以给我们留言或者咨询袋鼠君AI客服，看到留后会尽快回复。

押金退款：在确认没有要竞标的商品后，可以在微信小程序的个人中心里的我的押金里申请退押金，申请后请联系客服处理退款，退款到账约为1个工作日。

支持的支付方式：支持微信支付及支付宝支付。

支付运费：在微信小程序里的我的页面-国际物流订单页面查看国际运费并支付。

国际快递单号查询：可以通过微信小程序查询快递单号。如果已经支付国际运费，在微信小程序里的我的页面-国际物流订单-已出库页面查看国际快递单号。如果需要更为详细的快递记录信息，可以日本邮政https://trackings.post.japanpost.jp/services/srv/search/input输入快递单号进行查询。

日本国内快递方式;1.普通郵便(包括定形及定形外)，也叫平邮，无法无法追踪无保险，若丢失无法赔偿。2.未定，未确定发货方式，可能发送到付或者平邮。3.らくらくメルカリ便，可以追踪并有保险。4.ゆうゆうメルカリ便，可以追踪并有保险。5.着払い，也叫运费到付，可以追踪并有保险。6.ゆうメール，无法无法追踪无保险，若丢失无法赔偿。

禁止购买及邮寄的物品：香水、液体、磁石、高压气罐、易燃易爆物品、可燃性物质、酸性物质、有毒物质、腐蚀性物质、放射性物质、活体动植物、硬币、纸币、支票、有价证券等、学生制服、二手内衣、指甲油、单件商品重量超过30kg的物品、象牙、动物毛皮、管制刀具。
';
        return $rule;
    }

    public function goods()
    {
        $url = input('url', '');
        $uuid = input('uuid', '');
        if (empty($url) || empty($uuid)) {
            return $this->jerror('请输入链接');
        }
        $this->uuid = $uuid;
        try {
            $this->checkGoodsUrl($url);
        } catch (\Exception $e) {
            return $this->jerror($e->getMessage());
        }
        return $this->jsuccess('解析成功');
    }

    private function getGoodsDetail($content = '')
    {
        $key = 'chat_goods:' . $this->uuid;
        $redis = new StRedis();
        if (!empty($content)) {
            $redis->set($key, $content, 1800);
            return;
        }
        $cache = $redis->get($key);
        if (!empty($cache)) {
            return $cache;
        }

        return '未提供商品信息，提示用户输入煤炉、雅虎商品链接';
    }

}