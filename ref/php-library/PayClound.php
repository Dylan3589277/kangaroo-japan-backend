<?php
namespace app\common\library;

/**
 * 文档
 * https://gw.paycloud.world/docs/#/zh-cn/api-overview
 * 官网
 * https://www.paycloud.world/
 */
class PayClound
{
    protected $serverUrl = 'https://gw-hk.paycloud.world/api/entry';
    protected $publicKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApR/uqNJrLqgVjtD6e9K/QZxNyQnfcXFT1Sn5N3UOZfIvv0gRPLv/c0GXIf5wPpfJgMALOI0Lof2pUnOoRnxb3uaj88v4rlERg4PbPonXqn7+nqX8/JOFYWGvYJfo4whlk4VhVfPKXs8i6L+TU8WdIQBZ9hngKoMCsdgZPYX/BDjGxkZ+UYlqYCLVjXf9ac1D3CzL4sJslA6KZLCQQDtA3Xf8OM9xrTEPlnUZXWhHsA7jKXcHnfFd2UuDmWzu0zhYNiE8ncLI/RvREpiPbPp8EwXqP+y3YtTQ/dcpg78DzFx5cTe/lD/Vn3zubWQxgUAlpDNdl5fpWj9MAMd3XMPEYwIDAQAB';
    protected $privateKey = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQClH+6o0msuqBWO0Pp70r9BnE3JCd9xcVPVKfk3dQ5l8i+/SBE8u/9zQZch/nA+l8mAwAs4jQuh/alSc6hGfFve5qPzy/iuURGDg9s+ideqfv6epfz8k4VhYa9gl+jjCGWThWFV88pezyLov5NTxZ0hAFn2GeAqgwKx2Bk9hf8EOMbGRn5RiWpgItWNd/1pzUPcLMviwmyUDopksJBAO0Ddd/w4z3GtMQ+WdRldaEewDuMpdwed8V3ZS4OZbO7TOFg2ITydwsj9G9ESmI9s+nwTBeo/7Ldi1ND91ymDvwPMXHlxN7+UP9WffO5tZDGBQCWkM12Xl+laP0wAx3dcw8RjAgMBAAECggEAI3KgdGN/mOuCfT9FlpFed4JLfI3/BsZyXb99/bbGWYJNV73r3WLqat64yBZsGDPTkS0o+4Hj7mmbENU9WaxWuJpAthSilSFYJiiHR3yl7LcIiBxQHBS7PHWRBaZ2204xKCMpCx+j4QiMkPSXdxNkMPJ3XYqegeHQEUe322pJnakNwL2bQZ6FVrYJO0cqEN6L3B/83Qa+c4wmyD1B8kkr1BbdIItJ2URPbOvWAdVrP9iShDFoDA1a/PoAE8HiTV+y9gvoyDpvCagO7BfEWXpYDhQP+jXmN/AVyajjrzTqh1EiNUboJsl+c9OCljOdnNlypkSb+BPx1tx/26zkpwFkqQKBgQDmf0sXAfJabsSMqhnw8r67T4nq8Qo76OgdKjgCEz80Fg5EWD5jrU3l616Z1x/tN3hHTK7f1y/JRBWzlx/U8xWpDNT3yzvkDghGM6kFdaD89+XE0fH9mzBaTRpjHHz2STcTITs6IM9fi78Dxq1/hKzWVjnK0JGxfoqzLtjtcbFPPQKBgQC3ZP+7+RJuoXsbuEpIExzub1fpRxo4vgbQbRLIFXR4HNSrra7Vnj6aesEkUFeCWhhSX3eY3+VREcx03pVD9VDOGWWeeMMQT8SwQs0ansbhoTprlqsARjVhwFsAX8lmUqjpObZeJy+pKm7Y6lORD8DBID5ZnHcgR5oN1ecufCqcHwKBgDwmD6RLX8D1ktjaMrbLwbYDhYwHppIHrzqdH8x61U10S/jNxkogmWlcSG2A09YFWZ/RhPjooJG28KrSzv21CXv520FmiZRzjPk01fCUx5P75Lu9xZZWfwGxiSc/8eQbKwIU8+2xTiwyvX/wwqm6J5gvHBmu37YfvXYQzY740jpJAoGBALSHbpqaT4Op4CbkXfLfJa6s2kwfmvdaUBjiFgfx3snSD6PEAAP2l0e4KOJXWB1QFPsZUQCi/fi03Z/579OK6/VF2NuLovEupL6hs4dN3xcCgCCim0hU1H2aPbp7kCTyn6WeEyBR0L/krmNHH+X/LM6vr9DEjhuvgD24X69JuSQfAoGAHVifFNFupQXF8U0BLysiQlM5jiEGlMiICmji72vYQ/4qpZ3M6+gAK5rwdTrE6YnIB7xuWtEe5veL8esc+6TM3LWqO2COPu4YnieullBqE8unJdR02TFDVDDJ1O2n6M6gx1qiPS+S2ES0Ypn897t2OuvGsBNRwZIfqZ1M+HmA5Lw=';
    protected $signKey = 'Z5UTKAfNF7QB29pkWjguCm3rGvIcRyhV';

    public function pay($outTradeNo,$amount,$openid,$payMethod='WeChatPay'){
       $data = [
//           'method' => 'pay.miniprogram.order',
           'method' => $payMethod == 'WeChatPay'?'pay.miniprogram.order':'cscanb.pay.getqrcode',
//           'merchant_no' => '312200056803',//指定支付网关分配的商户ID
//           'store_no' => '4122000632',
           'store_no' => '4123000653',
           'merchant_no' => '312300064943',//指定支付网关分配的商户ID
//           'store_no' => '4123000674',
           'pay_method_id' => $payMethod,
//           'sub_pay_method_id' => 'Alipay',
           'merchant_order_no' => $outTradeNo,
           'price_currency' => 'CNY',
//           'price_currency' => 'JPY',
           'terminal_type' => 'WAP',
           'trans_amount' => $amount,//日元
           'expires' => 300,
           'description' => '袋鼠君支付',
           'notify_url' => 'https://app.kangaroo-japan.com/api/pay/gwnotify',
//           'sub_appid' => 'wx8ea38335fdde32a5',
//           'sub_openid' => $openid,
           'app_id' => 'wzcbbbf716c84b8b0b',
           'format' => 'JSON',
           'charset' => 'UTF-8',
           'sign_type' => 'RSA2',
           'version' => '1.0',
           'term_ip' => get_client_ip(),
           'attach' => md5($outTradeNo.$this->signKey),
           'timestamp' => sprintf('%s',intval(1000*microtime(true)))
       ];
       if($payMethod == 'WeChatPay'){
           $data['sub_appid'] = 'wx208645d960d3f104';
           $data['sub_openid'] = $openid;
           $data['merchant_no'] = '312300064943';
           $data['store_no'] = '4123000674';
           $data['price_currency'] = 'CNY';
       }
       ksort($data);
       $str = $this->ToUrlParams($data);
       $data['sign'] = $this->getSign($str);
       $header = [
           'Accept: application/json, text/plain, */*',
           'Content-Type: application/json; charset=UTF-8',
           'Request-Time: '.gmdate('Y-m-d\TH:i:s',time()).'+08:00'
       ];
//       echo json_encode($data,JSON_UNESCAPED_UNICODE);
       $result = request_post($this->serverUrl,json_encode($data,JSON_UNESCAPED_UNICODE),false,30,$header,false);
       return json_decode($result,true);
    }

    public function refund($tradeNo,$outRefundNo,$refundFee){
        $data = [
            'method' => 'order.refund.submit',
//            'merchant_no' => '312200056803',//指定支付网关分配的商户ID
            'merchant_no' => '312300064943',//指定支付网关分配的商户ID
            'orig_trans_no' => $tradeNo,
            'merchant_order_no' => $outRefundNo,
//            'price_currency' => 'JPY',
            'price_currency' => 'CNY',
            'trans_amount' => $refundFee,//日元
            'app_id' => 'wzcbbbf716c84b8b0b',
            'format' => 'JSON',
            'charset' => 'UTF-8',
            'sign_type' => 'RSA2',
            'version' => '1.0',
            'timestamp' => sprintf('%s',intval(1000*microtime(true)))
        ];
        ksort($data);
        $str = $this->ToUrlParams($data);
        $data['sign'] = $this->getSign($str);
        $header = [
            'Accept: application/json, text/plain, */*',
            'Content-Type: application/json; charset=UTF-8',
            'Request-Time: '.gmdate('Y-m-d\TH:i:s',time()).'+08:00'
        ];
        $result = request_post($this->serverUrl,json_encode($data,JSON_UNESCAPED_UNICODE),false,30,$header,false);
        $resArr = json_decode($result,true);
        if($resArr['code'] !== '0'){
            return [1,$resArr['msg']];
        }else{
            return [0,$resArr['data']];
        }
    }

    public function getPayRate(){
        $data = [
            'method' => 'exchage.rate.get',
            'merchant_no' => '312200056803',//指定支付网关分配的商户ID
            'store_no' => '4122000632',
            'pay_method_id' => 'WeChatPay',
            'foreign_currency' => 'JPY',
            'local_currency' => 'CNY',//日元
            'date' => date('Ymd',time()),
            'app_id' => 'wzcbbbf716c84b8b0b',
            'format' => 'JSON',
            'charset' => 'UTF-8',
            'sign_type' => 'RSA2',
            'version' => '1.0',
            'timestamp' => sprintf('%s',intval(1000*microtime(true)))
        ];
        ksort($data);
        $str = $this->ToUrlParams($data);
        $data['sign'] = $this->getSign($str);
        $header = [
            'Accept: application/json, text/plain, */*',
            'Content-Type: application/json; charset=UTF-8',
            'Request-Time: '.gmdate('Y-m-d\TH:i:s',time()).'+08:00'
        ];
        $result = request_post($this->serverUrl,json_encode($data,JSON_UNESCAPED_UNICODE),false,30,$header,false);
        $resArr = json_decode($result,true);
        if($resArr['code'] !== '0'){
            return [1,$resArr['msg']];
        }else{
            return [0,$resArr['data']];
        }
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

    private  function getSign($content){
        $privateKey = "-----BEGIN RSA PRIVATE KEY-----\n" .
            wordwrap($this->privateKey, 64, "\n", true) .
            "\n-----END RSA PRIVATE KEY-----";

        $key = openssl_get_privatekey($privateKey);
        openssl_sign($content, $signature, $key, "SHA256");
        openssl_free_key($key);
        $sign = base64_encode($signature);
        return $sign;
    }

    function verify($content, $sign){
        $publicKey = "-----BEGIN PUBLIC KEY-----\n" .
            wordwrap($this->publicKey, 64, "\n", true) .
            "\n-----END PUBLIC KEY-----";

        $key = openssl_get_publickey($publicKey);
        $ok = openssl_verify($content,base64_decode($sign), $key, 'SHA256');
        openssl_free_key($key);
        return $ok;
    }

    function  checkSign($data){
        if(empty($data['sign'])|| empty($data['attach'])){
            return false;
        }
        //
        $sign = md5($data['merchant_order_no'].$this->signKey);
        return $sign === $data['attach'];
//        if($sign !== $data['attach']){
//            return false;
//        }
//        ksort($data);
//        $str = $this->ToUrlParams($data);
//        $str = urldecode($str);
//        var_dump($str);
//        $newSign = $this->getSign($str);
//        var_dump($newSign);
//        var_dump($data['sign']);
//        return $newSign === $data['sign'];
    }
}