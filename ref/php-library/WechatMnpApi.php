<?php
namespace app\common\library;



use app\common\model\Configs;
use Tools\StRedis;

/**
 * 微信公众平台处理类
 */
class WechatMnpApi {
    protected $appid = "";
    protected $secrect = "";
    protected $accessToken;

    public function __construct()
    {
        $configArr = (new Configs())->getAllArr();
        $this->appid = $configArr['MNP_APPID'];
        $this->secrect = $configArr['MNP_SECRET'];
    }
    public function getSignPackage($url = false)
    {
        $jsapiTicket = $this->getJsApiTicket();
        if(!$url)
        {
            $url = "http://$_SERVER[HTTP_HOST]$_SERVER[REQUEST_URI]";
        }
        $timestamp = time();
        $nonceStr = $this->createNonceStr();
        // 这里参数的顺序要按照 key 值 ASCII 码升序排序
        $string = "jsapi_ticket=$jsapiTicket&noncestr=$nonceStr&timestamp=$timestamp&url=$url";
        $signature = sha1($string);
        $signPackage = array(
            "appId" => $this->appid,
            "nonceStr" => $nonceStr,
            "timestamp" => $timestamp,
            "url" => $url,
            "signature" => $signature,
            "rawString" => $string
        );
        return $signPackage;
    }

    private function createNonceStr($length = 16)
    {
        $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        $str = "";
        for ($i = 0; $i < $length; $i++) {
            $str .= substr($chars, mt_rand(0, strlen($chars) - 1), 1);
        }
        return $str;
    }

    private function getJsApiTicket()
    {
        // jsapi_ticket 应该全局存储与更新，以下代码以写入到文件中做示例
        $key = 'mnp:ticket:'.$this->appid;
        $redis = new StRedis();
        $ticket = $redis->get($key);
        if (empty($ticket)) {
            $accessToken = $this->getToken();
            // 如果是企业号用以下 URL 获取 ticket
            // $url = "https://qyapi.weixin.qq.com/cgi-bin/get_jsapi_ticket?access_token=$accessToken";
            $url = "https://api.weixin.qq.com/cgi-bin/ticket/getticket?type=jsapi&access_token=$accessToken";
            $res = json_decode(request_get($url));
            $ticket = $res->ticket;
            if ($ticket) {
               $redis->set($key,$ticket,7000);
            }
        }
        return $ticket;
    }

    /**
     * @param $appid
     * @param $appsecret
     * @return mixed
     * 获取token
     */
    public function getToken($cache=true)
    {
        $key = 'mnp:'.$this->appid;
        $redis = new StRedis();
        $access_token = '';
        if($cache){
            $access_token = $redis->get($key);
        }
        if (empty($access_token)) {
            $url = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=" . $this->appid . "&secret=" . $this->secrect;
            $result = request_get($url);
            $arr = json_decode($result, true);
            if(!isset($arr['access_token'])){
                throw new \Exception($arr['errmsg']);
            }
            $access_token = $arr['access_token'];
            if ($access_token) {
               $redis->set($key,$access_token,7000);
            }
        }
        return $access_token;
    }

    /**
     * 发送自定义的模板消息
     * @param $touser
     * @param $template_id
     * @param $url
     * @param $data
     * @param string $topcolor
     * @return bool
     */
    public function doSendTemplate($touser, $template_id, $url, $data, $topcolor = '#7B68EE',$miniprogram='')
    {
        /*
         * data=>array(
                'first'=>array('value'=>urlencode("您好,您已购买成功"),'color'=>"#743A3A"),
                'name'=>array('value'=>urlencode("商品信息:微时代电影票"),'color'=>'#EEEEEE'),
                'remark'=>array('value'=>urlencode('永久有效!密码为:1231313'),'color'=>'#FFFFFF'),
            )
         */
        $accessToken = $this->getToken();
        $template = array(
            'touser' => $touser,
            'template_id' => $template_id,
            'url' => $url,
            'topcolor' => $topcolor,
            'data' => $data
        );
        if(!empty($miniprogram)){
            $template['miniprogram'] = $miniprogram;
        }
        $json_template = json_encode($template);
        $url = "https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=" . $accessToken;
        $dataRes = request_post($url, urldecode($json_template));
        $resArr = json_decode($dataRes,true);
        if ($resArr['errcode'] != 0) {
            throw new \Exception($resArr['errmsg']);
        }
        return true;
    }


    public function makeqr($promot_id,$actionName = 'QR_STR_SCENE')
    {
        $data = array(
            'action_name' => $actionName,
            'expire_seconds' => 2592000,
            'action_info' => array(
                'scene' => array(
                    'scene_str' => $promot_id
                )
            )
        );
        $token = $this->getToken();
        $url = "https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=" . $token;
        $result = request_post($url, json_encode($data));
        $arr = json_decode($result, true);
        if (isset($arr['errcode']) && $arr['errcode'] != 0) {
            return false;
        }
        if($arr)
        {
            return [
                'qrcode' => "https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=".urlencode($arr['ticket']),
                'expire' => time() + $arr['expire_seconds']
            ];
        }
        else
        {
            return false;
        }
    }


    public function uploadMedia($path,$type='image')
    {
        $token = $this->getToken();
        $url = "https://api.weixin.qq.com/cgi-bin/media/upload?access_token=".$token."&type=".$type;
        $ch = curl_init();
        $postFields = array(
            'media'=> '@.'.$path
        );
        curl_setopt($ch, CURLOPT_HEADER, FALSE);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_TIMEOUT, 65);//设置本机的post请求超时时间，如果timeout参数设置60 这里至少设置65
        curl_setopt($ch, CURLOPT_POST, TRUE);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
        $result = curl_exec($ch);
        curl_close($ch);
        $arr = json_decode($result,true);
        if(isset($arr['media_id']))
        {
            return $arr['media_id'];
        }
        else
        {
            return false;
        }
    }

    public function getUserInfo($openid)
    {
        $token = $this->getToken();
        $url = 'https://api.weixin.qq.com/cgi-bin/user/info?access_token='.$token.'&openid='.$openid.'&lang=zh_CN';
        $result = request_get($url);
        $arr = json_decode($result,true);
        if($arr['errcode'] == 0)
        {
            return $arr;
        }
        else
        {
            return false;
        }
    }


    public function sendImage($openid,$media_id)
    {
        $token = $this->getToken();
        $url = 'https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token='.$token;
        $data = array(
            'msgtype' => 'image',
            'image' => array('media_id' => $media_id),
            'touser' => $openid
        );
        $result = request_post($url,json_encode($data));
        $arr = json_decode($result,true);
        if($arr['errcode']=== 0)
        {
            return true;
        }
        else
        {
            return false;
        }
    }

    public function sendText($openid,$content)
    {

        $token = $this->getToken();
        $url = 'https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token='.$token;


        $data = array(
            'msgtype' => 'text',
            'text' => array('content' => $content),
            'touser' => $openid
        );
        $json = json_encode($data,JSON_UNESCAPED_UNICODE);
        $result = request_post($url,$json);
        $arr = json_decode($result,true);
        if($arr['errcode']=== 0)
        {
            return true;
        }
        else
        {
            return false;
        }
    }


    /**
     * @param $token
     * @param $data
     * @return mixed|string
     * 创建菜单
     */
    function createMenu($arr)
    {
        $token = $this->getToken();
        $arr = $this->deArr($arr);
        $data = urldecode(stripslashes(json_encode($arr)));
        $url = "https://api.weixin.qq.com/cgi-bin/menu/create?access_token=" . $token;
        return request_post($url,$data);
    }

    /**
     * @param $arr
     * @return mixed
     * 将菜单中得name urldencode
     */
    function deArr($arr)
    {
        foreach($arr['button'] as $key => $value)
        {
            $value['name'] = urlencode($value['name']);
            foreach($value['sub_button'] as $key1 => $value1)
            {
                $value1['name'] = urlencode($value1['name']);
                $value['sub_button'][$key1] = $value1;

            }
            $arr['button'][$key] = $value;
        }
        return $arr;
    }
}
