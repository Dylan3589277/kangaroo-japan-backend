<?php
/**
 * Created by PhpStorm.
 * Date: 2021/9/8
 * Time: 15:14
 * description: 用户相关操作
 */

namespace app\api\controller;

use app\common\library\WechatApp;
use app\common\library\WechatMnpApi;
use app\common\logic\UserLogic;
use app\common\model\AddressModel;
use app\common\model\OrderModel;
use app\common\model\Pictures;
use app\common\model\ScoreLogs;
use app\common\model\SmsModel;
use app\common\model\UserCoupons;
use app\common\model\UserModel;
use app\common\service\aliyun\AliyunService;
use think\App;
use think\Exception;
use think\facade\Config;
use think\facade\Db;
use think\facade\Filesystem;
use think\helper\Str;
use Tools\StRedis;

class Users extends Base
{
    public function __construct(App $app)
    {
        parent::__construct($app);
    }

    /**
     * 用户信息
     */
    public function index()
    {
        $member = Db::name('member')
            ->where('phone',$this->userInfo['mobile'])
            ->find();

        $levelName = '普通会员';
        if($this->userInfo['level'] >0){
            $levelName = Db::name('user_levels')
                ->where('id',$this->userInfo['level'])
                ->value('name');
        }

        $mnpResult = Db::name('user_mnp')->where('uid',$this->uid)->find();

        $data = [
            'code' => $this->userInfo['code'],
            'nickname' => $this->userInfo['nickname'],
            'realname' => $this->userInfo['realname'],
//            'avatar' => !empty($this->userInfo['avatar'])?$this->userInfo['avatar']:'https://app.kangaroo-japan.com/uploads/picture/eb/b4dbc452ff1b1c2daab9108f5086e9.png',
            'avatar' => 'https://app.kangaroo-japan.com/uploads/picture/eb/b4dbc452ff1b1c2daab9108f5086e9.png',
            'mobile' => $this->userInfo['mobile'],
            'qq' => $this->userInfo['qq'] ?: '',
            'taobaoid' => $this->userInfo['taobaoid'] ?: '',
            'idno' => $this->userInfo['idno'] ?: '',
            'level' => $this->userInfo['level'],
            'level_name' => $levelName,
            'level_end_time' => date('Y/m/d',$this->userInfo['level_end_time']),
            'status' => 0,
            'pid' => $this->userInfo['pid']>0?0:1,
            'score' => $this->userInfo['score'],
            'admin' => $member?1:0,
            'mnp' => $mnpResult?1:0
        ];
        return $this->jsuccess('ok', $data);
    }

    public function mnpqrcode(){
        $key = 'bind_'.$this->uid;
        try {
            $result = (new WechatMnpApi())->makeqr($key);
            if(!$result){
                return $this->jerror('获取失败');
            }
            $mnpInfo = Db::name('user_mnp')->where('uid',$this->uid)->find();
            $status = $mnpInfo?$mnpInfo['status']:-1;
            return $this->jsuccess('ok',['qrcode' => $result['qrcode'],'status' => $status]);
        }catch (\Exception $e){
            return $this->jerror($e->getMessage());
        }
    }

    public function switchmnp(){
        $mnpInfo = Db::name('user_mnp')->where('uid',$this->uid)->find();
        if(!$mnpInfo){
            return $this->jerror('未绑定');
        }
        $res = Db::name('user_mnp')->where('uid',$this->uid)->update(['status' => $mnpInfo['status']==1?0:1]);
        if(!$res){
            return $this->jerror('更新失败');
        }
        return $this->jsuccess('更新成功');
    }

    /**
     * 登录积分
     */
    public function logintask(){
        $score = Db::name('config')->where('name','LOGIN_SCORE')->value('value');
        if(intval($score) <=0){
            return $this->jerror('error');
        }
        $logModel = new ScoreLogs();
        $result = $logModel
            ->where('uid',$this->uid)
            ->where('type',4)
            ->where('create_time','>',strtotime(date('Y-m-d')))
            ->find();
        if($result){
            return $this->jerror('已经领取过了');
        }
        $res = UserModel::addScore($this->uid,intval($score),4,'每日登录积分');
        if($res){
            return $this->jsuccess("每日登录+{$score}积分");
        }
        return $this->jerror('error');
    }

    /**
     * 设置上级
     */
    public function setinvite()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        $code = input('code', '');
        if (empty($code)) {
            return $this->jerror('请输入邀请码');
        }
        if ($this->userInfo['pid'] > 0) {
            return $this->jerror('已经绑定了上级不能再次绑定');
        }
        $this->requestLimit();
        $model = new UserModel();
        $model->startTrans();
        try {
            $parentInfo = $model
                ->where('code', trim($code))
                ->find();
            if (!$parentInfo) {
                throw new \Exception("该邀请码不存在");
            }

            $res = Db::name('users')
                ->where('id', $this->uid)
                ->update(['pid' => $parentInfo['id'],'update_time' => time()]);
            if (!$res) {
                throw new \Exception("绑定失败");
            }

            //-- 更新数量
            Db::name('users')
                ->where('id',$parentInfo['id'])
                ->inc('child')
                ->update();

            $model->commit();
            //-- 检查送优惠券活动
            (new UserLogic())->checkInviteCoupon($this->uid,$parentInfo['id']);
            return $this->jsuccess('绑定成功');
        } catch (\Exception $e) {
            $model->rollback();
            return $this->jerror($e->getMessage());
        }

    }


    /**
     * 修改用户信息
     * @return \think\response\Json
     */
    public function info()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        $form = input('post.');
        $data = [];
        if (isset($form['mobile'])) {
            //-- 更换手机号的逻辑
            $mobile = $form['mobile'];
            if (!checkMobile($mobile)) {
                return $this->jerror('请输入正确的手机号');
            }
            if (!empty($this->userInfo['mobile'])) {
                //-- 验证旧手机号
                $redis = new StRedis();
                $key = sprintf('mobile_verify:%s_%s', $this->userInfo['mobile'], $this->uid);
                $lastTime = $redis->get($key);
                if (intval($lastTime) <= 0 || time() - intval($lastTime) > 300) {
                    return $this->jerror('请先验证现在手机号');
                }
            }

            $code = input('code', '');
            if (strlen($code) != 4) {
                return $this->jerror('请输入短信验证码');
            }
            $res = (new SmsModel())->checkVerify($mobile, $code);
            if (!$res) {
                return $this->jerror('短信验证码验证失败');
            }

            //-- 判断手机号是否被使用
            $info = \think\facade\Db::name('users')
                ->where('mobile', $mobile)
                ->find();
            if ($info) {
                $this->jerror('该手机号已被占用');
            }

            $data['mobile'] = $mobile;
        } else {
            $fields = ['qq', 'taobaoid','nickname', 'realname', 'idno', 'idfront', 'idback'];
            foreach ($fields as $field) {
                if (isset($form[$field])) {
                    $data[$field] = $form[$field];
                }
            }
            if (empty($data)) {
                $this->jerror('请输入要修改的信息');
            }
        }

        $data['update_time'] = time();
        $res = \think\facade\Db::name('users')
            ->where('id', $this->uid)
            ->save($data);
        if (!$res) {
            $this->jerror('修改失败');
        }
        return $this->jsuccess('修改成功');
    }

    /**
     * 上传头像
     * @return \think\response\Json
     */
    public function avatar()
    {
        $files = request()->file();
        if (empty($files)) {
            return $this->jerror('请选择图片');
        }
        $this->jerror('暂时不允许修改头像');
        $fileName = array_keys($files)[0];
        $file = array_values($files)[0];
        try {
            validate([$fileName => ['fileSize:2048000', 'fileExt:jpg,png,jpeg']])
                ->check([$fileName => $file]);
            $path = Filesystem::disk('public')->putFile('picture', $file, 'md5');
            if(!$path){
                return $this->jerror('上传失败');
            }
            $path = \think\facade\Config::get('filesystem.disks.public.url').'/'.rtrim($path,'/');
            $res = \think\facade\Db::name('users')
                ->where('id', $this->uid)
                ->update(['avatar' => oss_url($path),'update_time' => time()]);
            if (!$res) {
                $this->jerror('修改失败');
            }
            return $this->index();
        }
        catch (Exception $e) {
            return $this->jerror($e->getMessage());
        }
    }

    /**
     * 验证当前手机号
     */
    public function verify()
    {
        $code = input('code', '');
        if (strlen($code) != 4) {
            return $this->jerror('短信验证错误');
        }
        $res = (new SmsModel())->checkVerify($this->userInfo['mobile'], $code);
        if (!$res) {
            return $this->jerror('当前手机号验证失败');
        }
        $redis = new StRedis();
        $key = sprintf('mobile_verify:%s_%s', $this->userInfo['mobile'], $this->uid);
        $redis->set($key, time(), 300);
        $redis->expire($key, 300);
        return $this->jsuccess('验证成功');
    }

    /**
     * 地址列表
     */
    public function address()
    {
        $result = Db::name('address')
            ->where('uid', $this->uid)
            ->where('is_deleted', 0)
            ->field('id,realname,mobile,province,postno,country,city,address,area,default')
            ->order('id desc')
            ->paginate(20)->toArray();
        return $this->jsuccess('ok', ['list' => $result['data'], 'totalPages' => ceil($result['total'] / 20)]);
    }

    /**
     * 提交地址修改和新增
     */
    public function submitAddress()
    {
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }
        $model = new AddressModel();
        $params = input('post.', '');
        $params['uid'] = $this->uid;
        list($errcode, $result) = $model->addRow($params);
        if ($errcode != 0) {
            return $this->jerror($result);
        }
        return $this->jsuccess('操作成功');
    }

    /**
     * 删除地址
     */
    public function delAddress()
    {
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }
        $id = input('id', '');
        if (intval($id) <= 0) {
            return $this->jerror('删除失败');
        }
        $model = new AddressModel();
        $info = $model
            ->where('id', intval($id))
            ->where('uid', $this->uid)
            ->where('is_deleted', 0)
            ->find();
        if (!$info) {
            $this->jerror('该地址不存在');
        }
        $res = $info->save(['is_deleted' => 1, 'update_time' => time()]);
        if ($res) {
            return $this->jsuccess('删除成功');
        }
        return $this->jerror('删除失败');
    }

    /**
     * 消息中心
     */
    public function messageindex()
    {

        $pubInfo = Db::name('user_messages')
            ->where('type',2)
            ->field('message,create_time,weapp_path')
            ->order('id desc')
            ->find();

        $unread = Db::name('user_messages')
            ->where('type',2)
            ->where('uid',$this->uid)
            ->count();

        $typeList = [
            [
                'icon' => 'http://res.kangaroo-japan.net/picture/a51b7bda820d04235fd5d6e63eb9ac63.png',
                'title' => '客服消息',
                'newTip' => false,
                'path' => '/pages/daishujun/kefu/kefu'
            ],
            [
                'icon' => 'http://res.kangaroo-japan.net/picture/ab8db5d1b1c4cad04ab4e58f0bc2c776.png',
                'title' => '我的消息',
                'newTip' => $unread>0,
                'path' => '/pages/daishujun/mine/messages?type=1'
            ],
            [
                'icon' => 'http://res.kangaroo-japan.net/picture/f90019d977d83afc683a5d1a82458c34.png',
                'title' => '公共消息',
                'newTip' => true,
                'id' => $pubInfo?$pubInfo['id']:0,
                'time' => $pubInfo?date('Y/m/d',$pubInfo['create_time']):'',
                'message' => $pubInfo?$pubInfo['messages']:'',
                'path' => '/pages/daishujun/mine/messages?type=2'
            ],
            [
                'icon' => 'http://res.kangaroo-japan.net/picture/2e9586171c54d9265391de951766d6db.png',
                'title' => '使用说明',
                'newTip' => false,
                'path' => '/pages/daishujun/article/article?name=帮助文档&cat=1297'
            ]
        ];

        return $this->jsuccess('ok', ['list' => $typeList]);
    }

    /**
     * 我的消息
     */
    public function messages()
    {
        $type = input('type',1);
        if(in_array($type,[1,2,3])){
            $map = [['type','=',$type]];
            if($type != 2){
                $map[] = ['uid','=',$this->uid];
            }
        }else{
            $map = [['uid','=',$this->uid]];
        }

        $result = Db::name('user_messages')
            ->where($map)
            ->field('message,create_time,weapp_path')
            ->order('id desc')
            ->paginate(20)->toArray();
        $list = $result['data'];
        foreach ($list as &$item) {
            $item['create_time'] = date('Y/m/d H:i', $item['create_time']);
        }
        if(!empty($list)){
            Db::name('user_messages')->where('id','in',array_column($list,'id'))->update(['status' => 0]);
        }
        return $this->jsuccess('ok', ['list' => $list, 'totalPages' => ceil($result['total'] / 20)]);
    }

    /**
     * 押金情况
     */
    public function deposit()
    {
        $count = Db::name('user_refunds')
            ->where('uid', $this->uid)
            ->where('status', 0)
            ->count();


        $articleInfo = Db::name('articles')
            ->where('id', 49)
            ->field('content')
            ->find();

        $tipStr = '<p>1、弃标会扣除押金或保证金。</p><p>2、竞标金额最高可以竞标保证金x100 的价格的商品。</p><p>3、若充值100人民币可最高出价至10000日元，多个出价商品共享额度。</p>';
        if($articleInfo){
            $tipStr = stripslashes($articleInfo['content']);
        }

        $data = [
            'deposit' => $this->userInfo['deposit'],
            'refund_count' => intval($count),
            'msg' => '竞标金额最高可以竞标保证金x100 的价格的商品',
            'tipStr' => $tipStr,
            'tipList' => [
                '1、弃标会扣除押金或保证金。',
                '2、竞标金额最高可以竞标保证金x100 的价格的商品。',
                '3、若充值100人民币可最高出价至10000日元，多个出价商品共享额度。',
            ]
        ];
        return $this->jsuccess('ok', $data);
    }

    /**
     * 申请充值
     */
    public function recharge()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        $money = input('money', 0);
        if (intval($money) <= 0) {
            return $this->jerror('请输入金额');
        }
        if (intval($money) < floatval($money)) {
            return $this->jerror('只能输入整数金额');
        }
        $data = [
            'uid' => $this->uid,
            'money' => $money,
            'out_trade_no' => date('ymdhis', time()) . Str::random(6),
            'create_time' => time(),
            'update_time' => time()
        ];
        $rid = Db::name('user_recharge')
            ->insert($data, true);
        if ($rid) {
            return $this->jsuccess('ok', ['id' => $rid, 'money' => $money]);
        }
        return $this->jerror('充值失败');
    }


    /**
     * 押金退款
     */
    public function refund()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }

        //-- 检查是否有未完成的竞拍
        $count = Db::name('yahoo_bids')
            ->where('uid',$this->uid)
            ->where('status',1)
            ->count();
        if($count > 0){
            return $this->jerror('你还有未完成的竞拍，暂时不能申请');
        }


        $alipayNo = input('alipay_no','');
        $alipayRealname = input('alipay_realname','');
        $money = input('money','');
        if(empty($alipayNo) || empty($alipayRealname)){
            return $this->jerror('请输入支付宝账号信息');
        }
        if(floatval($money) <=0){
            return $this->jerror('请输入退款金额');
        }

        $count = Db::name('user_refunds')
            ->where('uid', $this->uid)
            ->where('status', 0)
            ->count();
        if (intval($count) > 0) {
            return $this->jerror('你还有未处理的申请');
        }

        $model = new UserModel();
        $userInfo = $model
            ->where('id', $this->uid)
            ->find();
        if ($userInfo['deposit'] < floatval($money)) {
            return $this->jerror('你的押金不足');
        }

        Db::startTrans();
        try {
            //-- 扣除
            $res = $model
                ->where('id', $this->uid)
                ->save(['deposit' => $userInfo['deposit'] - floatval($money)]);
            if (!$res) {
                throw new \Exception('申请失败');
            }
            //-- 加记录
            $res = Db::name('user_refunds')
                ->insert([
                    'uid' => $this->uid,
                    'money' => floatval($money),
                    'alipay_no' => $alipayNo,
                    'alipay_realname' => $alipayRealname,
                    'pay_way' => 'alipay',
                    'status' => 0,
                    'create_time' => time(),
                    'update_time' => time()
                ]);
            if (!$res) {
                throw new \Exception('申请失败');
            }
            Db::commit();
            return $this->jsuccess('申请成功');
        } catch (\Exception $e) {
            Db::rollback();
            return $this->jerror($e->getMessage());
        }
    }

    /**
     * 退款押金历史
     */
    public function refundhistory(){
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        $typeArr = [
            'refund' =>'押金退回',
            'recharge' => '押金充值',
            'admin_recharge' => '后台充值',
            'deduct' => '押金扣除'
        ];
        $statusArr = [
            '0' => '处理中',
            '1' => '已处理',
            '2' => '申请退款被拒绝'
        ];
        $result = Db::name('user_refunds')
            ->where('uid',$this->uid)
            ->field('alipay_no,alipay_realname,status,money,result,type,create_time')
            ->order('id desc')
            ->paginate(50)->toArray();
        $list = $result['data'];
        foreach ($list as &$item){
            $item['type_txt'] = $typeArr[$item['type']];
            $item['status_txt'] = $statusArr[$item['status']];
            $item['create_time'] = date('Y/m/d H:i',$item['create_time']);
        }
        return $this->jsuccess('ok',['list' => $list]);
    }

    /**
     * 我的收藏
     */
    public function collects()
    {
        $result = Db::name('user_collects')
            ->where('uid', $this->uid)
            ->where('is_deleted',0)
            ->order('id desc')
            ->field('goods_no,goods_name,cover,price,seller,seller_address,shop')
            ->paginate(20)->toArray();
        $list = $result ? $result['data'] : [];
        foreach ($list as &$item){
            $item['shop_txt'] = OrderModel::getShopArr($item['shop']);
        }
        $totalPages = $result ? ceil($result['total'] / 20) : 0;
        return $this->jsuccess('ok', ['list' => $list, 'totalPages' => $totalPages]);
    }

    /**
     * 收藏和取消收藏
     */
    public function docollect()
    {
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }
        $goodsNo = input('goods_no', '');
        $shop = input('shop', '');
        if (empty($goodsNo) || empty($shop)) {
            return $this->jerror('参数错误');
        }

        $info = Db::name('user_collects')
            ->where('uid', $this->uid)
            ->where('goods_no', $goodsNo)
            ->find();
        if ($info) {
            $res = Db::name('user_collects')
                ->where('uid', $this->uid)
                ->where('goods_no', $goodsNo)
                ->save(['is_deleted' => $info['is_deleted'] == 1 ? 0 : 1, 'update_time' => time()]);

        } else {
            $shop = input('shop','mercari');
            if(!in_array($shop,['mercari','amazon','yahoo'])){
                return $this->jerror('参数错误');
            }
            $key = sprintf('%s_%s', $shop,$goodsNo);
            $redis = new StRedis();
            $json = $redis->get($key);
            if (empty($json)) {
                return $this->jerror('操作错误');
            }
            $goodsInfo = is_array($json) ? $json : json_decode($json, true);
            if($shop == 'yahoo'){
                if($goodsInfo['bid_price'] <=0){
                    return $this->jerror('商品异常'.$goodsInfo['bid_price']);
                }
                $goodsInfo['price'] = $goodsInfo['bid_price'];
            }else if($goodsInfo['price'] <=0){
                return $this->jerror('商品异常');
            }

            if (!$goodsInfo) {
                return $this->jerror('该商品不存在');
            }

            $data = [
                'uid' => $this->uid,
                'goods_no' => $goodsNo,
                'goods_name' => $goodsInfo['goods_name'],
                'cover' => $goodsInfo['cover'],
                'shop' => $shop,
                'price' => $goodsInfo['price'],
                'seller' => $goodsInfo['seller'],
                'seller_address' => $goodsInfo['seller_address'],
                'update_time' => time(),
                'create_time' => time()
            ];
            $res = Db::name('user_collects')
                ->insert($data);
        }

        if (!$res) {
            return $this->jerror('操作失败');
        }
        return $this->jsuccess('操作成功');

    }

    /**
     * 优惠券列表
     * @return \think\response\Json
     * @throws \think\db\exception\DbException
     */
    public function coupons(){
        $model = new UserCoupons();
        $result = $model
            ->where('uid',$this->uid)
            ->where('status',0)
            ->where('expire','>',time())
            ->field('name,order_type,type,data,expire,condition')
            ->order('status asc,expire desc')
            ->paginate(20)->toArray();
        $orderTypeArr = [
            'goods' => '代拍订单可用',
            'ship' => '出库订单可用',
            'normal' => '全部订单可用'
        ];
        $list = array_map(function($item)use($orderTypeArr){
            $item['type'] = $item['type'] =='rate'?'折':'元';
            $item['order_type'] = $orderTypeArr[$item['order_type']];
            $item['expire'] = is_string($item['expire'])?$item['expire']:date('Y-m-d H:i:s',$item['expire']);
            $item['condition'] = $item['condition']>0?sprintf('满%s可用',$item['condition']):'无最低门槛';
            return $item;
        },$result['data']);
        return $this->jsuccess('ok',['list' => $list,'total' => intval($result['total'])]);
    }

    public function shares(){
        $appid = input('appid','');
        if($appid == 'wx8ea38335fdde32a5'){
            $wechat = new WechatApp('wx8ea38335fdde32a5','c76e77ffa1c4b1079ca63ee933490b2f');
        }else{
            $wechat = new WechatApp();
        }
        try {
            $qrcodeUrl = $this->userInfo['mnp_qrcode'];
            if(empty($this->userInfo['mnp_qrcode'])){
                $path = 'pages/daishujun/index/index?inviteCode='.$this->userInfo['code'];
                $result = $wechat->createQrCodeLimited($path);
                if(!$result){
                    return $this->jerror('二维码生成失败');
                }
                $aliyun = new AliyunService(Config::get('config'));
                $url = $aliyun->putObject($result,"qrcode");
                if(!$url){
                    return $this->jerror('二维码生成失败Err2');
                }
                (new UserModel())->where('id',$this->uid)->save(['mnp_qrcode' => $url]);
                $qrcodeUrl = $url;
            }

            $picture = config('config.SHARE_PICTURE');
            return $this->jsuccess('ok',['qrcode' => $qrcodeUrl,'picture' => $picture]);
        }catch (\Exception $e){
            return $this->jerror($e->getMessage());
        }
    }
}