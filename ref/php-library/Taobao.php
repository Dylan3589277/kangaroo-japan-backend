<?php

namespace app\common\library;

use think\facade\Db;

class Taobao
{
    private $agisoConfig;
    public function __construct()
    {
        $this->agisoConfig =  [
            // 本番
//        'AppId' => "20171020823891",
//        'AppSecret' => "wkgdn27zhwhbd5sdtzn59ps3p8gtdmen",
            'AppId' => "2021101039981223441",
            'AppSecret' => "rvr66rte8m5xpp9ptrgmzs3nkkncudyk",
//        'AccessToken' => 'aldsm6tedrkfk9vpwdkz8fc2dkpumhss37rt7frkkb7uf3h3e',
            'AccessToken' => 'TbAlds7ts5fadsnyrn77992x77xzbbkczwb6dggnt34hmem3aa'
        ];
    }


    /**
     * Taobao用 署名
     *
     * @param array $args APIに渡すパラメータの配列
     * @param string $client_secret API接続に使うappSecret
     * @return string
     */
    private function signTaobao($args, $client_secret)
    {
        ksort($args);
        $str = '';
        foreach ($args as $key => $value) {
            $str .= ($key . $value);
        }
        $str = $client_secret . $str . $client_secret;
        $encodeStr = md5($str);
        return $encodeStr;
    }

    /**
     * Taobao 获取订单详情
     *
     * @param string $tid taobaoの注文番号
     * @return array
     */
    public function getTaobaoOrder(string $tid)
    {
        if (!$tid) {
            throw new \Exception('淘宝订单号不能为空');
        }

        $appKey = $this->agisoConfig['AppId'];
        $appSecret = $this->agisoConfig['AppSecret'];
        $accessToken = $this->agisoConfig['AccessToken'];

        $params = [];
        $dt = new \DateTime();
        $params['tid'] = $tid;
        $params['timestamp'] = $dt->getTimestamp();
        $params['sign'] = $this->signTaobao($params, $appSecret);
        $headers[] = "Authorization: Bearer " . $accessToken;
        $headers[] = "ApiVersion: 1";

        $ci = curl_init();
        curl_setopt($ci, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_0);
        curl_setopt($ci, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ci, CURLOPT_ENCODING, "");
        curl_setopt($ci, CURLOPT_SSL_VERIFYHOST, 2);
        curl_setopt($ci, CURLOPT_HEADER, false);
        curl_setopt($ci, CURLOPT_POST, true);
        curl_setopt($ci, CURLOPT_POSTFIELDS, $params);
        curl_setopt($ci, CURLOPT_URL, 'http://gw.api.agiso.com/alds/Trade/TradeInfo');
        curl_setopt($ci, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ci, CURLINFO_HEADER_OUT, true);
        curl_setopt($ci, CURLOPT_TIMEOUT, 15);
        $response = curl_exec($ci);
        Db::name('debug_logs')->insert(['content' => $response]);
        curl_close($ci);
        $array = json_decode($response, true);
        if ($err_code = json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception('failed json parse. error_code = '.$err_code);
        }
        if (!$array['IsSuccess']) {
            throw new \Exception('taobao API error.');
        }
        return $array['Data'];
    }

    /**
     * Taobao 确认收货
     *
     * @param string $tid
     * @return array
     */
    public function logisticsDummySend(string $tid)
    {
        if (!$tid) {
            throw new \Exception('Taobao order_id is empty.');
        }

        $appKey = $this->agisoConfig['AppId'];
        $appSecret = $this->agisoConfig['AppSecret'];
        $accessToken = $this->agisoConfig['AccessToken'];

        $params = [];
        $dt = new \DateTime();
        $params['tids'] = $tid;
        $params['timestamp'] = $dt->getTimestamp();
        $params['sign'] = $this->signTaobao($params, $appSecret);
        $headers[] = "Authorization: Bearer " . $accessToken;
        $headers[] = "ApiVersion: 1";

        $ci = curl_init();
        curl_setopt($ci, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_0);
        curl_setopt($ci, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ci, CURLOPT_ENCODING, "");
        curl_setopt($ci, CURLOPT_SSL_VERIFYHOST, 2);
        curl_setopt($ci, CURLOPT_HEADER, false);
        curl_setopt($ci, CURLOPT_POST, true);
        curl_setopt($ci, CURLOPT_POSTFIELDS, $params);
        curl_setopt($ci, CURLOPT_URL, 'http://gw.api.agiso.com/alds/Trade/LogisticsDummySend');
        curl_setopt($ci, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ci, CURLINFO_HEADER_OUT, true);
        curl_setopt($ci, CURLOPT_TIMEOUT, 15);
        $response = curl_exec($ci);
        curl_close($ci);
        $array = json_decode($response, true);
        if ($err_code = json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception('failed json parse. error_code = '.$err_code);
        }
        if (!$array['IsSuccess']) {
            throw new \Exception('Taobao API error.');
        }
        return $array;
    }

    /**
     * Taobaoのエラーメッセージを返す
     *
     * @param int $errorCode
     * @return string
     */
    public static function getTaobaoErrorMessage(int $errorCode)
    {
        $error = [
            1 => 'invalid access token.',
            2 => 'Api call limit.',
            3 => 'Business exception.',
            4 => 'Verification failure.',
            5 => 'Parameter error.',
            6 => 'Partial failure.',
            7 => 'All failed.',
            8 => 'Authorization failure.',
            9 => 'The transaction does not exist.',
            10 => 'Taobao Api request error.',
            114 => 'no data.',
        ];
        return $error[$errorCode] ?? 'Error:'.$errorCode;
    }
}