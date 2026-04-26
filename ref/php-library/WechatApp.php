<?php
/**
 * Created by PhpStorm.
 * User: StandOpen
 * Date: 2020/1/4
 * Time: 19:02
 * Email:standopen@foxmail.com
 * description:
 */

namespace app\common\library;

use GuzzleHttp\Client;
use think\facade\Db;
use Tools\StRedis;

class WechatApp
{
    private $appId = 'wxe7b1b61d6d6bae3f';
    private $appSecret = '63bd3db3ab6a694cb3edcdaba414a8d4';
    private $client = null;

    public function __construct($appid='',$appsecret='')
    {
        if(!empty($appid) && !empty($appsecret)){
            $this->appId = $appid;
            $this->appSecret = $appsecret;
        }else{
            $this->appId = config('config.WEAPP_APPID');
            $this->appSecret = config('config.WEAPP_APPSECRET');
        }
        $this->client = new Client();
    }

    /**
     * https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/login/auth.code2Session.html
     * session_key,appid,unionid
     * @param $code
     */
    public function code2session($code)
    {
        $url = 'https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code';
        $url = sprintf($url, $this->appId, $this->appSecret, $code);
        $response = $this->client->get($url);
        $resArr = json_decode($response->getBody(), true);
        return $resArr;
    }

    /**
     * https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html
     * 检验数据的真实性，并且获取解密后的明文.
     * @param $encryptedData string 加密的用户数据
     * @param $iv string 与用户数据一同返回的初始向量
     * @param $data string 解密后的原文
     *{
     * "openId": "OPENID",
     * "nickName": "NICKNAME",
     * "gender": GENDER,
     * "city": "CITY",
     * "province": "PROVINCE",
     * "country": "COUNTRY",
     * "avatarUrl": "AVATARURL",
     * "unionId": "UNIONID",
     * "watermark":
     * {
     * "appid":"APPID",
     * "timestamp":TIMESTAMP
     * }
     * }
     */
    public function decryptData($encryptedData, $iv, $sessionKey)
    {
        if (strlen($sessionKey) != 24) {
            return [1, 'sessionKey 错误'];
        }
        $aesKey = base64_decode($sessionKey);
        if (strlen($iv) != 24) {
            return [1, 'iv 错误'];
        }
        $aesIV = base64_decode($iv);
        $aesCipher = base64_decode($encryptedData);
        $result = openssl_decrypt($aesCipher, "AES-128-CBC", $aesKey, 1, $aesIV);
        $dataArr = json_decode($result, true);
        if ($dataArr == NULL) {
            return [1, '解析失败,请稍后再试'];
        }
        Db::name('debug_logs')
            ->insert(['content' => $result]);
        if ($dataArr['watermark']['appid'] != $this->appId) {
            return [1, '解析失败'];
        }
        if (isset($dataArr['watermark'])) {
            $dataArr = array_merge($dataArr, $dataArr['watermark']);
            unset($dataArr['watermark']);
        }
        return [0, array_change_key_case($dataArr, CASE_LOWER)];
    }

    public function setSessionKey($openid,$sessionKey){
        \think\facade\Cache::set($openid,$sessionKey,86400*7);
    }

    public function getSessionKey($openid){
        return \think\facade\Cache::get($openid);
    }

    /**
     * @return mixed
     * 获取token
     */
    public function getToken($forceRefresh= false)
    {
        $url = 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s';
        $url = sprintf($url, $this->appId, $this->appSecret);
        $redis = new StRedis();
        $access_token =  $redis->get($this->appId);
        if ($access_token && !$forceRefresh) {
            return $access_token;
        }
        $response = $this->client->get($url);
        $result = $response->getBody();
        $arr = json_decode($result, true);
        $access_token = $arr['access_token'];
        if (!isset($arr['access_token'])) {
            return false;
        }
        $redis->set($this->appId, $access_token, 7000);
        return $access_token;
    }

    /**
     * 生成有数量限制小程序码
     * @param $fid
     * @return bool|mixed
     */
    public function createQrCodeLimited($path, $width = 400,$time=1)
    {
        $token = $this->getToken();
        $url = 'https://api.weixin.qq.com/wxa/getwxacode?access_token=' . $token;
        $data = [
            'path' => $path,
            'width' => $width
        ];
        $result = $this->client->request('POST', $url, ['json' => $data]);
        $contents =  $result->getBody()->getContents();
        if(stripos($contents,'"errcode"') != false){
            $arr = json_decode($contents,true);
            if($time > 1){
                throw new \Exception( $arr['errmsg']);
            }
            if($arr['errcode'] == 40001){
               $this->getToken(true);
               return $this->createQrCodeLimited($path,$width,2);
            }
        }
        return $contents;
    }

    /**
     * 生成无数量限制小程序码
     * @param $path
     * @return bool|mixed
     */
    public function createQrCodeUnLimited($path)
    {
        $token = $this->getToken();
        $url = 'https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=' . $token;
        $data = [
            'path' => $path,
        ];
        $result = $this->client->request('POST', $url, ['json' => $data]);
        return $result->getBody()->getContents();
    }

    public function createQrCodeLimitedByPath($path,$width=400)
    {
        $token = $this->getToken();
        $url = 'https://api.weixin.qq.com/wxa/getwxacode?access_token=' . $token;
        $data = [
            'path' => $path,
            'width' => $width
        ];
        $result = $this->client->request('POST', $url, ['json' => $data]);
        return $result->getBody();
    }

    /**
     * 获取用户访问小程序数据概况
     * {
     * "list": [
     * {
     * "ref_date": "20170313",
     * "visit_total": 391,
     * "share_pv": 572,
     * "share_uv": 383
     * }
     * ]
     * }
     * @param $begin_date
     * @param $end_date
     * @return mixed|\Psr\Http\Message\ResponseInterface
     */
    public function getweanalysisappiddailysummarytrend($begin_date, $end_date)
    {
        $token = $this->getToken();
        $url = 'https://api.weixin.qq.com/datacube/getweanalysisappiddailysummarytrend?access_token=' . $token;
        $data = [
            'begin_date' => $begin_date,
            'end_date' => $end_date
        ];
        $result = $this->client->request('POST', $url, ['json' => $data]);
        return $result->getBody();
    }

    /**
     * 发送订阅消息
     */
    public function sendMsg($touser,$template_id,$page,$data){

        $access_token = $this->getToken();
        $url = sprintf('https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=%s',$access_token);
        $form = [
            'touser' =>$touser,
            'template_id' => $template_id,
            'page' => $page,
            'data' => $data
        ];
        $response = request_post($url,json_encode($form),false,30,false,false);
        $resArr = json_decode($response,true);
        if($resArr['errcode'] != 0){
            throw new \Exception($resArr['errmsg']);
        }
        return true;
    }

}