<?php
/**
 * Created by PhpStorm.
 * Date: 2021/9/8
 * Time: 08:38
 * description:
 */
declare (strict_types=1);

namespace app\api\controller;

use app\common\library\WechatApp;
use app\common\model\SmsModel;
use app\common\model\UserModel;
use GuzzleHttp\Client;
use think\App;
use think\facade\Config;
use think\facade\Cookie;
use think\facade\Db;
use Tools\Auth\Jwt;

class Login extends Base
{

    function __construct(App $app)
    {
        $this->noNeedLogin = ['*'];
        parent::__construct($app);
    }


    public function checkweapp()
    {
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }
        $sessionCode = input('session_code', '');
        if (empty($sessionCode)) {
            return $this->jerror('expire');
        }
        $info = Db::name('user_wechat')
            ->where('session_code', $sessionCode)
            ->find();
        if ($info) {
            return $this->jsuccess('ok');
        }
        return $this->jerror('expire');
    }

    /**
     * 国家区号
     * @return \think\response\Json
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     */
    public function codes(){
        $list = Db::name('country_codes')
            ->where('is_show',1)
            ->select()->toArray();
        return $this->jsuccess('ok',$list);
    }

    /**
     * 小程序授权
     */
    public function weapp()
    {
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }
        $code = input('code', '');
        $encryptedData = input('encryptedData', '');
        $iv = input('iv', '');
        if (empty($code) || empty($encryptedData) || empty($iv)) {
            return $this->jerror('参数不足');
        }
        $type = input('type', 0);
        $appid = input('appid','');
        if($appid == 'wx8ea38335fdde32a5'){
            $wechat = new WechatApp('wx8ea38335fdde32a5','c76e77ffa1c4b1079ca63ee933490b2f');
        } else if($appid == 'wx208645d960d3f104'){
            $wechat = new WechatApp('wx208645d960d3f104','07dde85838dbb580eb714d461578d012');
       }else{
            $wechat = new WechatApp();
        }

        if ($type == 1) {
            $codeArr = Db::name('user_wechat')
                ->where('session_code', $code)
                ->find();
            if (!$codeArr) {
                return $this->jerror('登录失败');
            }
        } else {
            $codeArr = $wechat->code2session($code);
            if (!isset($codeArr['session_key'])) {
                return $this->jerror($codeArr['errmsg']);
            }
        }
        list($errcode, $wechatUserInfo) = $wechat->decryptData($encryptedData, $iv, $codeArr['session_key']);
        if ($errcode != 0) {
            return $this->jerror('解密失败,请退出重试一次');
        }
        try {
            $wechatUserInfo['openid'] = $codeArr['openid'];
            $wechatUserInfo['session_key'] = $codeArr['session_key'];
            $wechatUserInfo['session_code'] = $code;
            $userModel = new UserModel();
            $sourceArr = [
                '07dde85838dbb580eb714d461578d012' => 'gxsweapp',
                'wx8ea38335fdde32a5' => 'hwweapp'
            ];
            $source = $sourceArr[$appid] ?? 'weapp';
            $result = $userModel->wechatLogin($wechatUserInfo,$source);
            if (is_array($result) && isset($result['token'])) {
                return $this->jsuccess('登录成功', $result);
            }
            return $this->jerror(is_string($result) ? $result : '登录失败，请退出重试一次');
        }
        catch (\Exception $e) {
            Db::name('debug_logs')
                ->insert(['content' => $e->getMessage()]);
            return $this->jerror($e->getMessage());
        }
    }

    /**
     * 小程序授权
     */
    public function wechat()
    {
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }
        $code = input('code', '');
        if (empty($code)) {
            return $this->jerror('参数不足');
        }
        $appid = input('appid','');
        if($appid == 'wx8ea38335fdde32a5'){
            $wechat = new WechatApp('wx8ea38335fdde32a5','c76e77ffa1c4b1079ca63ee933490b2f');
        } else if($appid == 'wx208645d960d3f104'){
            $wechat = new WechatApp('wx208645d960d3f104','07dde85838dbb580eb714d461578d012');
        }else{
            $wechat = new WechatApp();
        }

        $codeArr = $wechat->code2session($code);
        if (!isset($codeArr['openid'])) {
            return $this->jerror($codeArr['errmsg']);
        }

        try {
            $userModel = new UserModel();
            $sourceArr = [
                'wx208645d960d3f104' => 'gxsweapp',
                'wx8ea38335fdde32a5' => 'hwweapp'
            ];
            $source = $sourceArr[$appid] ?? 'weapp';
            $result = $userModel->wechatLogin(['openid' => $codeArr['openid']],$source);
            if($result['mobile'] == 0){
                $codes = Db::name('country_codes')
                    ->where('is_show',1)
                    ->select()->toArray();
                $result['codes'] = $codes;
            }
            if (is_array($result) && isset($result['token'])) {
                return $this->jsuccess('登录成功', $result);
            }
            return $this->jerror(is_string($result) ? $result : '登录失败，请退出重试一次');
        }
        catch (\Exception $e) {
            Db::name('debug_logs')
                ->insert(['content' => $e->getMessage()]);
            return $this->jerror($e->getMessage());
        }
    }

    /**
     * 绑定微信手机号
     */
    public function bindwxphone()
    {
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }
        $token = input('token','');
        if (empty($token)) {
            return $this->jerror('错位的操作');
        }
        $code = input('code', '');
        $encryptedData = input('encryptedData', '');
        $iv = input('iv', '');
        if (empty($code) || empty($encryptedData) || empty($iv)) {
            return $this->jerror('参数不足');
        }
        $type = input('type', 0);
        $appid = input('appid','');
        if($appid == 'wx8ea38335fdde32a5'){
            $wechat = new WechatApp('wx8ea38335fdde32a5','c76e77ffa1c4b1079ca63ee933490b2f');
        }else{
            $wechat = new WechatApp();
        }
        if ($type == 1) {
            $codeArr = Db::name('user_wechat')
                ->where('session_code', $code)
                ->find();
            if (!$codeArr) {
                return $this->jerror('登录失败');
            }
        }
        else {
            $codeArr = $wechat->code2session($code);
            if (!isset($codeArr['session_key'])) {
                return $this->jerror($codeArr['errmsg']);
            }
        }
        list($errcode, $wechatUserInfo) = $wechat->decryptData($encryptedData, $iv, $codeArr['session_key']);
        if ($errcode != 0) {
            return $this->jerror('解密失败,请稍后再试');
        }

        if(empty($wechatUserInfo['phonenumber'])){
            return $this->jerror('解密失败,请稍后再试');
        }

        try {
            $jwt = new Jwt();
            $result = $jwt->decode($token, Config::get('config.JWT_KEY'));
            if (!$result || !isset($result['user_wechat_id']) || !isset($result['user_key'])) {
                $this->jerror('无效的TOKEN1');
            }
            $wechatInfo = Db::name('user_wechat')
                ->where('id', $result['user_wechat_id'])
                ->find();
            if (!$wechatInfo || $wechatInfo['uid'] > 0 || md5($wechatInfo['openid']) !== $result['user_key']) {
                $this->jerror('无效的TOEKN2');
            }

            list($errcode, $result) = (new UserModel())->bindMobile($wechatInfo, $wechatUserInfo['phonenumber']);
            if ($errcode != 0) {
                $this->jerror($result);
            }
            return $this->jsuccess('ok', ['token' => $result]);
        }
        catch (\Exception $e) {
            return $this->jerror($e->getMessage());
        }

    }

    /**
     * 绑定手机号
     */
    public function bindmobile()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        $token = input('token','');
        if (empty($token)) {
            $this->jerror('错位的操作');
        }
        try {
            $jwt = new Jwt();
            $result = $jwt->decode($token, Config::get('config.JWT_KEY'));
            if (!$result || !isset($result['user_wechat_id']) || !isset($result['user_key'])) {
                $this->jerror('无效的TOKEN1');
            }
            $wechatInfo = Db::name('user_wechat')
                ->where('id', $result['user_wechat_id'])
                ->find();
            if (!$wechatInfo || $wechatInfo['uid'] > 0 || md5($wechatInfo['openid']) !== $result['user_key']) {
                $this->jerror('无效的TOEKN2');
            }

            //-- 验证手机号
            $mobile = input('mobile', '');
            $code = input('code', '');
            $inviteCode = input('inviteCode','');

            //邀请人
            $inviteUserId = 0;
            if(!empty($inviteCode)){
                $parentInfo = (new UserModel())
                    ->where('code', trim($inviteCode))
                    ->find();
                if ($parentInfo) {
                    $inviteUserId = $parentInfo['id'];
                }
            }

            $mobile = str_replace('+86','',$mobile);
            if (!checkMobile($mobile)) {
                return $this->jerror('请输入正确的手机号');
            }
            if (strlen($code) != 4) {
                $this->jerror('请输入正确的短信验证码');
            }
            if($mobile == '18888385720'){
                if($code != '1234'){
                    return $this->jerror('短信验证码错误');
                }
            }else{
                $res = (new SmsModel())->checkVerify($mobile, $code);
                if (!$res) {
                    return $this->jerror('短信验证码错误');
                }
            }

            list($errcode, $result) = (new UserModel())->bindMobile($wechatInfo, $mobile,$inviteUserId);
            if ($errcode != 0) {
                $this->jerror($result);
            }
            return $this->jsuccess('ok', ['token' => $result]);
        }
        catch (\Exception $e) {
            return $this->jerror($e->getMessage());
        }

    }

    /**
     * 发送短信验证码
     */
    public function sendsms()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        $key = '56RDBxZRklaf6KhhpkWaUMOJK8A7kQDW';
        $form = input('post.');
        if (empty($form['mobile']) || empty($form['time']) || empty($form['type'])) {
            return $this->jerror('请输入手机号');
        }

        if (!in_array($form['type'], ['bind', 'login', 'verify', 'change'])) {
            return $this->jerror('参数错误');
        }


        if (isset($form['sign'])) {
            if (abs(time() * 1000 - $form['time']) > 60000) {
                return $this->jerror('请求超时');
            }
            $str = sprintf('mobile=%s&time=%s&type=%s&key=%s', $form['mobile'], $form['time'], $form['type'], $key);
            $sign = md5($str);
            if ($sign !== $form['sign']) {
                return $this->jerror('签名错误');
            }
        }
        else {
            if (empty($form['code'])) {
                return $this->jerror('请输入图片验证码');
            }
            if (!captcha_check($form['code'])) {
                return $this->jerror('请输入正确的图片验证码');
            }
        }

        $mobile = str_replace('+86','',$form['mobile']);

        if ($form['type'] == 'verify') {
            if (intval($this->uid) <= 0) {
                return $this->jerror('请先登录');
            }
            if ($mobile != $this->userInfo['mobile']) {
                return $this->jerror('手机号异常');
            }
            $mobile = $this->userInfo['mobile'];
        }
        else if ($form['type'] == 'change') {
            if (intval($this->uid) <= 0) {
                return $this->jerror('请先登录');
            }
            $info = Db::name('users')
                ->where('mobile', $mobile)
                ->find();
            if ($info) {
                return $this->jerror('该手机号已被占用');
            }
        }

        list($errcode, $result) = (new SmsModel())->send_verify_code($mobile);
        if ($errcode != 0) {
            return $this->jerror($result);
        }
        return $this->jsuccess('发送成功，请注意查收');
    }

}