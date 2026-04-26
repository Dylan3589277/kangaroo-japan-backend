<?php
/**
 * Created by PhpStorm.
 * Date: 2021/9/8
 * Time: 09:51
 * description:
 */
namespace app\common\library;


class AliyunSms{

    private static $obj;
    private $signName;
    private $templateCode;
    private $templateCodeGj;
    private $limitIpSendCount;

    /**
     * 私有化构造方法
     */
    public function __construct()
    {
        //短信签名
        $this->signName = '袋鼠君';
        //短信模板ID
        $this->templateCode = 'SMS_249085085';
        $this->templateCodeGj = 'SMS_249210068';
        //每个ip每天限制发送条数
        $this->limitIpSendCount = 20;

    }

    /**
     * 获取类的实例
     */
    public static function getInstance()
    {
        if (self::$obj instanceof self) {
            return self::$obj;
        } else {
            self::$obj = new self;
            return self::$obj;
        }
    }

    /**
     * notes: 发送
     * author: singwa
     * time: 2021/6/24 上午10:28
     * @param $mobile
     * @param int $codeLength
     * @return array
     */
    public function sendSms($mobile,$code)
    {
        $templateCode = $this->templateCode;
        if(stripos($mobile,'+')!==false){
            $templateCode = $this->templateCodeGj;
        }

        $accessKeyId = config('config.accessKeyId');
        $accessKeySecret = config('config.accessKeySecret');

        \AlibabaCloud\Client\AlibabaCloud::accessKeyClient($accessKeyId, $accessKeySecret)
            ->regionId('ap-northeast-1')
            ->asDefaultClient();

        try {
            $result = \AlibabaCloud\Client\AlibabaCloud::rpc()
                ->product('Dysmsapi')
                // ->scheme('https') // https | http
                ->version('2017-05-25')
                ->action('SendSms')
                ->method('POST')
                ->host('dysmsapi.aliyuncs.com')
                ->options([
                    'query' => [
                        'PhoneNumbers' => $mobile,
                        'SignName' => $this->signName,
                        'TemplateCode' => $templateCode,
                        'TemplateParam' => json_encode(['code' => $code]),
                    ],
                ])
                ->request();
            $resArr = $result->toArray();
            if(isset($resArr['Message']) && $resArr['Message'] == 'OK'){
                return [0,'发送成功'];
            }
            return [1,'发送失败'];
        } catch (\AlibabaCloud\Client\Exception\ClientException $e) {
            return array(1, '发送失败1');
        } catch (\AlibabaCloud\Client\Exception\ServerException $e) {
            return array(1, '发送失败2');
        }
    }



    /**
     * 私有化克隆方法
     */
    private function __clone()
    {
    }
}
