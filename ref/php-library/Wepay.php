<?php
/**
 * Created by PhpStorm.
 * User: StandOpen
 * Date: 2020/1/4
 * Time: 20:12
 * Email:standopen@foxmail.com
 * description:
 */
namespace app\common\library;


class Wepay
{

    //文档地址  https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html
    private $config;
    private $sslCertPath = '/home/wwwroot/daishujun/data/certs/apiclient_cert.pem';
    private $sslKeyPath = '/home/wwwroot/daishujun/data/certs/apiclient_key.pem';

    public function __construct($config)
    {
        $this->config = $config;
    }

    /**
     *
     * 统一下单，WxPayUnifiedOrder中out_trade_no、body、total_fee、trade_type必填
     * appid、mchid、spbill_create_ip、nonce_str不需要填入
     * @param WxPayConfigInterface $config 配置对象
     * @param WxPayUnifiedOrder $inputObj
     * @param int $timeOut
     * @throws WxPayException
     * @return 成功时返回，其他抛异常
     */
    public function unifiedOrder($data, $timeOut = 6)
    {
        $url = "https://api.mch.weixin.qq.com/pay/unifiedorder";
        //检测必填参数
        if (!isset($data['out_trade_no'])) {
            throw new \Exception("缺少统一支付接口必填参数out_trade_no！");
        } else if (!isset($data['body'])) {
            throw new \Exception("缺少统一支付接口必填参数body！");
        } else if (!isset($data['total_fee'])) {
            throw new \Exception("缺少统一支付接口必填参数total_fee！");
        } else if (!isset($data['trade_type'])) {
            throw new \Exception("缺少统一支付接口必填参数trade_type！");
        }


        //关联参数
        if ($data['trade_type'] == "JSAPI" && empty($data['openid'])) {
            throw new \Exception("统一支付接口中，缺少必填参数openid！trade_type为JSAPI时，openid为必填参数！");
        }
        if ($data['trade_type'] == "NATIVE" && empty($data['product_id'])) {
            throw new \Exception("统一支付接口中，缺少必填参数product_id！trade_type为JSAPI时，product_id为必填参数！");
        }

        //异步通知url未设置，则使用配置文件中的url
        if (empty($data['notify_url'])) {
            throw new \Exception("统一支付接口中，notify_url！");
        }
        $data['appid'] = $this->config['appid'];
        $data['mch_id'] = $this->config['mch_id'];
        $data['spbill_create_ip'] = $_SERVER['REMOTE_ADDR'];
        $data['nonce_str'] = $this->getNonceStr();
        $data['sign'] = $this->MakeSign($data);
        //签名
        $xml = $this->toXml($data);
        $response = $this->postXmlCurl($xml, $url, false, $timeOut);
        $result = $this->fromXml($response);
        return $result;
    }



    /**
     *
     * 申请退款，WxPayRefund中out_trade_no、transaction_id至少填一个且
     * out_refund_no、total_fee、refund_fee、op_user_id为必填参数
     * appid、mchid、spbill_create_ip、nonce_str不需要填入
     * @param WxPayRefund $inputObj
     * @param int $timeOut
     *
     *
     * 需要判断  result_code  是否 为 success
     * Array ( [return_code] => SUCCESS [return_msg] => OK [appid] => wx84d6de39d3136d49 [mch_id] => 1486337152 [nonce_str] => 85XP9GNDfCEtBfP7 [sign] => B2A21BE6189B74D3A29E44505C20EA00 [result_code] => FAIL [err_code] => INVALID_REQUEST [err_code_des] => 订单已全额退款 )
     * Array ( [return_code] => SUCCESS [return_msg] => OK [appid] => wx84d6de39d3136d49 [mch_id] => 1486337152 [nonce_str] => 1MaS3POujQUO1B4F [sign] => C320E4436F504925A5C5A41F99D3866A [result_code] => SUCCESS [transaction_id] => 4200001235202110110055192666 [out_trade_no] => 20211011105532286907 [out_refund_no] => 1634020784 [refund_id] => 50301109622021101213284525999 [refund_channel] => Array ( ) [refund_fee] => 1 [coupon_refund_fee] => 0 [total_fee] => 1 [cash_fee] => 1 [coupon_refund_count] => 0 [cash_refund_fee] => 1 )
     *
     */
    public function refund($data, $timeOut = 6)
    {
        $url = "https://api.mch.weixin.qq.com/secapi/pay/refund";
        //检测必填参数
        if (empty($data['out_trade_no']) && empty($data['transaction_id'])) {
            throw new \Exception("退款申请接口中，out_trade_no、transaction_id至少填一个！");
        } else if (empty($data['out_refund_no'])) {
            throw new \Exception("退款申请接口中，缺少必填参数out_refund_no！");
        } else if (empty($data['total_fee'])) {
            throw new \Exception("退款申请接口中，缺少必填参数total_fee！");
        } else if (empty($data['refund_fee'])) {
            throw new \Exception("退款申请接口中，缺少必填参数refund_fee！");
        }
        $data['appid'] = $this->config['appid'];
        $data['mch_id'] = $this->config['mch_id'];
        $data['nonce_str'] = $this->getNonceStr();
        $data['sign'] = $this->MakeSign($data);
        //签名
        $xml = $this->toXml($data);
        $response = $this->postXmlCurl($xml, $url, true, $timeOut);
        $result = $this->fromXml($response);
        try{
            $resArr = is_array($result)?$result:json_decode($result,true);
            if(!isset($resArr['result_code'])){
                return [1,'退款失败'];
            }
            if(strtolower($resArr['result_code']) !== 'success'){
                return [1,$resArr['err_code_des']];
            }

            return [0,$resArr];

        }catch (\Exception $e){
            return [1,$e->getMessage()];
        }
    }

    /**
     * 设置证书地址
     * @param $cert
     * @param $key
     */
    public function setCert($cert, $key)
    {
        $this->sslCertPath = $cert;
        $this->sslKeyPath = $key;
    }

    /**
     *
     * 产生随机字符串，不长于32位
     * @param int $length
     * @return 产生的随机字符串
     */
    public function getNonceStr($length = 32)
    {
        $chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        $str = "";
        for ($i = 0; $i < $length; $i++) {
            $str .= substr($chars, mt_rand(0, strlen($chars) - 1), 1);
        }
        return $str;
    }

    /**
     * 生成签名
     * @param WxPayConfigInterface $config 配置对象
     * @param bool $needSignType 是否需要补signtype
     * @return 签名，本函数不覆盖sign成员变量，如要设置签名需要调用SetSign方法赋值
     */
    public function MakeSign($values, $SignType = 'MD5')
    {
        $key = $this->config['key'];
        //签名步骤一：按字典序排序参数
        ksort($values);
        $string = $this->ToUrlParams($values);
        //签名步骤二：在string后加入KEY
        $string = $string . "&key=" . $key;
        //签名步骤三：MD5加密或者HMAC-SHA256
        if ($SignType == "MD5") {
            $string = md5($string);
        } else if ($SignType == "HMAC-SHA256") {
            $string = hash_hmac("sha256", $string, $key);
        } else {
            throw new \Exception("签名类型不支持！");
        }

        //签名步骤四：所有字符转为大写
        $result = strtoupper($string);
        return $result;
    }

    /**
     * 格式化参数格式化成url参数
     */
    public function ToUrlParams($values)
    {
        $buff = "";
        foreach ($values as $k => $v) {
            if ($k != "sign" && $v != "" && !is_array($v)) {
                $buff .= $k . "=" . $v . "&";
            }
        }

        $buff = trim($buff, "&");
        return $buff;
    }

    /**
     * 输出xml字符
     * @throws WxPayException
     **/
    public function ToXml($values)
    {
        if (!is_array($values) || count($values) <= 0) {
            throw new \Exception("数组数据异常！");
        }

        $xml = "<xml>";
        foreach ($values as $key => $val) {
            if (is_numeric($val)) {
                $xml .= "<" . $key . ">" . $val . "</" . $key . ">";
            } else {
                $xml .= "<" . $key . "><![CDATA[" . $val . "]]></" . $key . ">";
            }
        }
        $xml .= "</xml>";
        return $xml;
    }

    /**
     * 将xml转为array
     * @param string $xml
     * @throws WxPayException
     */
    public function FromXml($xml)
    {
        if (!$xml) {
            throw new \Exception("xml数据异常！");
        }
        //将XML转为array
        //禁止引用外部xml实体
        libxml_disable_entity_loader(true);
        $values = json_decode(json_encode(simplexml_load_string($xml, 'SimpleXMLElement', LIBXML_NOCDATA)), true);
        return $values;
    }

    /**
     * @param WxPayConfigInterface $config 配置对象
     * 检测签名
     */
    public function CheckSign($data)
    {
        if (!array_key_exists('sign', $data)) {
            return false;
        }

        $sign = $this->MakeSign($data);
        if ($data['sign'] == $sign) {
            //签名正确
            return true;
        }
        return false;
    }

    /**
     * 以post方式提交xml到对应的接口url
     *
     * @param WxPayConfigInterface $config 配置对象
     * @param string $xml 需要post的xml数据
     * @param string $url url
     * @param bool $useCert 是否需要证书，默认不需要
     * @param int $second url执行超时时间，默认30s
     * @throws WxPayException
     */
    private function postXmlCurl($xml, $url, $useCert = false, $second = 30,$headers=null)
    {
        $ch = curl_init();
        $curlVersion = curl_version();
        $ua = "WXPaySDK/1.0.0 (" . PHP_OS . ") PHP/" . PHP_VERSION . " CURL/" . $curlVersion['version'] . " "
            . $this->config['mch_id'];

        //设置超时
        curl_setopt($ch, CURLOPT_TIMEOUT, $second);

        $proxyHost = "0.0.0.0";
        $proxyPort = 0;
//        $config->GetProxy($proxyHost, $proxyPort);
//        //如果有配置代理这里就设置代理
//        if($proxyHost != "0.0.0.0" && $proxyPort != 0){
//            curl_setopt($ch,CURLOPT_PROXY, $proxyHost);
//            curl_setopt($ch,CURLOPT_PROXYPORT, $proxyPort);
//        }
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, TRUE);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);//严格校验
        curl_setopt($ch, CURLOPT_USERAGENT, $ua);
        //设置header
        curl_setopt($ch, CURLOPT_HEADER, FALSE);
        //要求结果为字符串且输出到屏幕上
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

        if($headers){
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        }

        if ($useCert == true) {
            //设置证书
            //使用证书：cert 与 key 分别属于两个.pem文件
            //证书文件请放入服务器的非web目录下
            //$config->GetSSLCertPath($sslCertPath, $sslKeyPath);
            curl_setopt($ch, CURLOPT_SSLCERTTYPE, 'PEM');
            curl_setopt($ch, CURLOPT_SSLCERT, $this->sslCertPath);
            curl_setopt($ch, CURLOPT_SSLKEYTYPE, 'PEM');
            curl_setopt($ch, CURLOPT_SSLKEY, $this->sslKeyPath);
        }
        //post提交方式
        curl_setopt($ch, CURLOPT_POST, TRUE);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $xml);
        //运行curl
        $data = curl_exec($ch);
        //返回结果
        if ($data) {
            curl_close($ch);
            return $data;
        } else {
            $error = curl_errno($ch);
            curl_close($ch);
            throw new \Exception("curl出错，错误码:$error");
        }
    }


    /**
     * 获取毫秒级别的时间戳
     */
    private function getMillisecond()
    {
        //获取毫秒的时间戳
        $time = explode(" ", microtime());
        $time = $time[1] . ($time[0] * 1000);
        $time2 = explode(".", $time);
        $time = $time2[0];
        return $time;
    }
}