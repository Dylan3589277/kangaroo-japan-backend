<?php
namespace app\common\library;

/**
 * Created by PhpStorm.
 * User: standopen
 * Date: 2020/11/10
 * Time: 2:36 PM
 */

Class H5Alipay
{

    //应用ID
    public $appId;
    //私钥文件路径
    public $rsaPrivateKeyFilePath;

    //私钥值
    public $rsaPrivateKey;
    //网关
    public $gatewayUrl = "https://openapi.alipay.com/gateway.do";
    //返回数据格式
    public $format = "json";
    //api版本
    public $apiVersion = "1.0";

    public $apiMethodName = 'alipay.trade.wap.pay';
    // 表单提交字符集编码
    public $postCharset = "UTF-8";


    public $alipayPublicKey = "";

    public $alipayrsaPublicKey = "";


    public $debugInfo = false;

    private $fileCharset = "UTF-8";

    private $RESPONSE_SUFFIX = "_response";


    private $SIGN_NODE_NAME = "sign";

    //签名类型
    public $signType = "RSA2";

    //加密密钥和类型
    public $encryptKey;

    public $encryptType = "AES";

    protected $alipaySdkVersion = "alipay-sdk-php-20161101";

    public $config = null;

    public function __construct($config)
    {
        $this->config = $config;
        $this->alipayrsaPublicKey = $this->config['alipay_public_key'];
        $this->rsaPrivateKey = $this->config['merchant_private_key'];
        $this->appId = $this->config['app_id'];
    }

    /**
     * 校验$value是否非空
     *  if not set ,return true;
     *    if is null , return true;
     **/
    protected function checkEmpty($value)
    {
        if (!isset($value))
            return true;
        if ($value === null)
            return true;
        if (trim($value) === "")
            return true;

        return false;
    }

    /**
     *
     * {"alipay_trade_refund_response":{"code":"40004","msg":"Business Failed","sub_code":"ACQ.INVALID_PARAMETER","sub_msg":"参数无效：退款金额不能为空 ","refund_fee":"0.00","send_back_fee":"0.00"}
     *
     *{"alipay_trade_refund_response":{"code":"10000","msg":"Success","buyer_logon_id":"188******20","buyer_user_id":"2088602993534878","fund_change":"Y","gmt_refund_pay":"2021-10-12 15:58:33","out_trade_no":"20211011113347533977","refund_fee":"0.01","send_back_fee":"0.00","trade_no":"2021101122001434871411630904"}
     *
     * @param $tradeNo
     * @param $refundAmount
     * @return bool|mixed
     */
    public function refund($tradeNo,$refundAmount,$outTradeNo=''){
        $iv = $this->apiVersion;
        //组装系统参数
        $sysParams["app_id"] = $this->appId;
        $sysParams["version"] = $iv;
        $sysParams["format"] = $this->format;
        $sysParams["sign_type"] = $this->signType;
        $sysParams["method"] = 'alipay.trade.refund';
        $sysParams["timestamp"] = date("Y-m-d H:i:s");
        $sysParams["alipay_sdk"] = $this->alipaySdkVersion;
        $sysParams["terminal_type"] = '';
        $sysParams["terminal_info"] = '';
        $sysParams["prod_code"] = '';
        $sysParams["notify_url"] = $this->config['notify_url'];
        $sysParams["return_url"] = $this->config['return_url'];
        $sysParams["charset"] = $this->postCharset;
        $sysParams["app_auth_token"] = '';
        $sysParams["biz_content"] = json_encode(['trade_no' => $tradeNo,'refund_amount' => $refundAmount,'out_request_no' => $outTradeNo]);
        $sysParams["refund_amount"] = $refundAmount;
        //获取业务参数
        $apiParams = [];

        //签名
        $sysParams["sign"] = $this->generateSign(array_merge($apiParams, $sysParams), $this->signType);
        //系统参数放入GET请求串
        $requestUrl = $this->gatewayUrl . "?";
        foreach ($sysParams as $sysParamKey => $sysParamValue) {
            $requestUrl .= "$sysParamKey=" . urlencode($this->characet($sysParamValue, $this->postCharset)) . "&";
        }
        $requestUrl = substr($requestUrl, 0, -1);
        //发起HTTP请求
        try {
            $resp = $this->curl($requestUrl, $apiParams);
            $resArr = json_decode($resp,true);
            if(!isset($resArr['alipay_trade_refund_response'])){
                return false;
            }
            $data = $resArr['alipay_trade_refund_response'];
            if(intval($data['code']) == 10000){
                return [0,$data];
            }
            return [1,$data['sub_msg']];
        } catch (\Exception $e) {
            return [1,$e->getMessage()];
        }
    }


    public function execute($bizContent, $authToken = '', $appInfoAuthtoken = '')
    {
        $iv = $this->apiVersion;
        //组装系统参数
        $sysParams["app_id"] = $this->appId;
        $sysParams["version"] = $iv;
        $sysParams["format"] = $this->format;
        $sysParams["sign_type"] = $this->signType;
        $sysParams["method"] = $this->apiMethodName;
        $sysParams["timestamp"] = date("Y-m-d H:i:s");
        $sysParams["auth_token"] = $authToken;
        $sysParams["alipay_sdk"] = $this->alipaySdkVersion;
        $sysParams["terminal_type"] = '';
        $sysParams["terminal_info"] = '';
        $sysParams["prod_code"] = '';
        $sysParams["notify_url"] = $this->config['notify_url'];
        $sysParams["return_url"] = $this->config['return_url'];
        $sysParams["charset"] = $this->postCharset;
        $sysParams["app_auth_token"] = $appInfoAuthtoken;
        //获取业务参数
        $apiParams = ['biz_content' => $bizContent];
        //签名
        $sysParams["sign"] = $this->generateSign(array_merge($apiParams, $sysParams), $this->signType);
        //系统参数放入GET请求串
        $requestUrl = $this->gatewayUrl . "?";
        foreach ($sysParams as $sysParamKey => $sysParamValue) {
            $requestUrl .= "$sysParamKey=" . urlencode($this->characet($sysParamValue, $this->postCharset)) . "&";
        }
        $requestUrl = substr($requestUrl, 0, -1);
        //发起HTTP请求
        try {
            $resp = $this->curl($requestUrl, $apiParams);
        } catch (\Exception $e) {
            return false;
        }


        return $resp;
    }


    function verify($data, $sign, $signType = 'RSA')
    {

        $pubKey = $this->alipayrsaPublicKey;
        $res = "-----BEGIN PUBLIC KEY-----\n" .
            wordwrap($pubKey, 64, "\n", true) .
            "\n-----END PUBLIC KEY-----";

        ($res) or die('支付宝RSA公钥错误。请检查公钥文件格式是否正确');

        //调用openssl内置方法验签，返回bool值


        if ("RSA2" == $signType) {
            $result = (bool)openssl_verify($data, base64_decode($sign), $res, OPENSSL_ALGO_SHA256);
        } else {
            $result = (bool)openssl_verify($data, base64_decode($sign), $res);
        }


        return $result;
    }


    public function generateSign($params, $signType = "RSA")
    {
        return $this->sign($this->getSignContent($params), $signType);
    }

    public function rsaSign($params, $signType = "RSA")
    {
        return $this->sign($this->getSignContent($params), $signType);
    }

    protected function getSignContent($params)
    {
        ksort($params);
        $stringToBeSigned = "";
        $i = 0;
        foreach ($params as $k => $v) {
            if (false === $this->checkEmpty($v) && "@" != substr($v, 0, 1)) {

                // 转换成目标字符集
                $v = $this->characet($v, $this->postCharset);

                if ($i == 0) {
                    $stringToBeSigned .= "$k" . "=" . "$v";
                } else {
                    $stringToBeSigned .= "&" . "$k" . "=" . "$v";
                }
                $i++;
            }
        }

        unset ($k, $v);
        return $stringToBeSigned;
    }

    function parserJSONSignData($responseContent, $responseJSON)
    {
        $signData = [];
        $signData['sign'] = $this->parserJSONSign($responseJSON);
        $signData['signSourceData'] = $this->parserJSONSignSource($responseContent);
        return $signData;
    }

    function parserJSONSignSource($responseContent)
    {

        $apiName = $this->apiMethodName;
        $rootNodeName = str_replace(".", "_", $apiName) . $this->RESPONSE_SUFFIX;
        $arr = json_decode($responseContent, true);
        return isset($arr[$rootNodeName]) ? json_encode($arr[$rootNodeName]) : null;
    }

    function parserJSONSource($responseContent, $nodeName, $nodeIndex)
    {
        $signDataStartIndex = $nodeIndex + strlen($nodeName) + 2;
        $signIndex = strpos($responseContent, "\"" . $this->SIGN_NODE_NAME . "\"");
        // 签名前-逗号
        $signDataEndIndex = $signIndex - 1;
        $indexLen = $signDataEndIndex - $signDataStartIndex;
        if ($indexLen < 0) {

            return null;
        }

        return substr($responseContent, $signDataStartIndex, $indexLen);

    }

    function parserJSONSign($responseJSon)
    {

        return $responseJSon->sign;
    }


    protected function sign($data, $signType = "RSA")
    {
        if ($this->checkEmpty($this->rsaPrivateKeyFilePath)) {
            $priKey = $this->rsaPrivateKey;
            $res = "-----BEGIN RSA PRIVATE KEY-----\n" .
                wordwrap($priKey, 64, "\n", true) .
                "\n-----END RSA PRIVATE KEY-----";
        } else {
            $priKey = file_get_contents($this->rsaPrivateKeyFilePath);
            $res = openssl_get_privatekey($priKey);
        }

        ($res) or die('您使用的私钥格式错误，请检查RSA私钥配置');

        if ("RSA2" == $signType) {
            openssl_sign($data, $sign, $res, OPENSSL_ALGO_SHA256);
        } else {
            openssl_sign($data, $sign, $res);
        }

        if (!$this->checkEmpty($this->rsaPrivateKeyFilePath)) {
            openssl_free_key($res);
        }
        $sign = base64_encode($sign);
        return $sign;
    }

    /**
     * 转换字符集编码
     * @param $data
     * @param $targetCharset
     * @return string
     */
    function characet($data, $targetCharset)
    {

        if (!empty($data)) {
            $fileType = $this->fileCharset;
            if (strcasecmp($fileType, $targetCharset) != 0) {
                $data = mb_convert_encoding($data, $targetCharset, $fileType);
                //				$data = iconv($fileType, $targetCharset.'//IGNORE', $data);
            }
        }


        return $data;
    }

    protected function curl($url, $postFields = null)
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_FAILONERROR, false);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        $postBodyString = "";
        $encodeArray = Array();
        $postMultipart = false;



        if (is_array($postFields) && 0 < count($postFields)) {

            foreach ($postFields as $k => $v) {
                if ("@" != substr($v, 0, 1)) //判断是不是文件上传
                {

                    $postBodyString .= "$k=" . urlencode($this->characet($v, $this->postCharset)) . "&";
                    $encodeArray[$k] = $this->characet($v, $this->postCharset);
                } else //文件上传用multipart/form-data，否则用www-form-urlencoded
                {
                    $postMultipart = true;
                    $encodeArray[$k] = new \CURLFile(substr($v, 1));
                }

            }
            unset ($k, $v);
            curl_setopt($ch, CURLOPT_POST, true);
            if ($postMultipart) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $encodeArray);
            } else {
                curl_setopt($ch, CURLOPT_POSTFIELDS, substr($postBodyString, 0, -1));
            }
        }

        if ($postMultipart) {

            $headers = array('content-type: multipart/form-data;charset=' . $this->postCharset . ';boundary=' . $this->getMillisecond());
        } else {

            $headers = array('content-type: application/x-www-form-urlencoded;charset=' . $this->postCharset);
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);


        $reponse = curl_exec($ch);

        if (curl_errno($ch)) {

            throw new \Exception(curl_error($ch), 0);
        } else {
            $httpStatusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            if (200 !== $httpStatusCode) {
                throw new \Exception($reponse, $httpStatusCode);
            }
        }

        return $reponse;
    }

    protected function getMillisecond()
    {
        list($s1, $s2) = explode(' ', microtime());
        return (float)sprintf('%.0f', (floatval($s1) + floatval($s2)) * 1000);
    }


}