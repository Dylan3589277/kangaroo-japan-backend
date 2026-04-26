<?php
/**
 * Created by PhpStorm.
 * Date: 2021/9/8
 * Time: 09:35
 * description:
 */
namespace app\common\model;

use app\common\library\AliyunSms;
use GuzzleHttp\Client;
use think\facade\Request;
use think\helper\Str;
use think\Model;

class SmsModel extends Model
{
    protected $table = 'st_sms';
    /**
     * 发送短信
     * @param $email
     * @return array
     */
    public function send_verify_code($mobile)
    {
        if (!checkMobile($mobile)) {
            return [1, '手机格式不合法'];
        }

        //判断ip当天是否已经发送了多少
        $ip = Request::ip();

        if (empty($ip)) {
            return [1, '请求不合法'];
        }

        $count = $this
            ->where('ip',$ip)
            ->where('create_time','>',time() - 3600)
            ->count();
        if ($count >= 30) {
            return [1, '发送太频繁'];
        }

        $count = $this
            ->where('mobile',$mobile)
            ->where('create_time','>',time() - 3600)
            ->count();
        if ($count >= 10) {
            return [1, '发送太频繁'];
        }

        $code = Str::random(4,1);
       $smsApi = new AliyunSms();
       list($errcode, $errmsg) = $smsApi->sendSms($mobile, $code);

       if ($errcode != 0) {
           return [1, $errmsg];
       }
//        $res = $this->send2Code($mobile,$code);
//        if(!$res){
//            return [1,'发送失败'];
//        }

        //发送成功,做记录
        $data = array(
            'mobile' => $mobile,
            'code' => $code,
            'ip' => $ip,
            'create_time' => time()
        );
        $this->insert($data);
        return array(0, '发送成功');
    }

    private function send2Code($phone,$code){
        $url = 'https://api.1cloudsp.com/api/v2/single_send';
        $data = [
            'accesskey' => 'IQKZ2kwaTEunYUuZ',
            'secret' => 'z7XWwREBZvS1iHGqBMpTIEirmLA1LbEG',
            'sign' => '【袋鼠君日本代拍】',
            'templateId' => '26717',
            'mobile' => $phone,
            'content' => $code
        ];
        $client = new Client([
            // Base URI is used with relative requests
            'base_uri' => $url,
            // You can set any number of default request options.
            'timeout'  => 30,
        ]);
        $response = $client->request('POST','',['form_params' => $data]);
        $json = $response->getBody()->getContents();
        if(is_string($json)){
            $json = json_decode($json,true);
        }
        return isset($json['code']) && intval($json['code']) == 0;
    }

    /**
     * 检查短信验证码
     */
    public  function checkVerify($mobile, $code)
    {
        //-- 获取最新的记录
        $info = $this
            ->where('mobile',$mobile)
            ->where('status',0)
            ->where('code',$code)
            ->order('id desc')
            ->find();
        if (!$info) {
            return false;
        }
        $info->save(['status' => 1]);
        //-- 超过5分钟
        if (strtotime($info['create_time']) + 300 < time()) {
            return false;
        }
        return true;
    }
}