<?php

namespace app\common\library;

class Translate
{
    private $url = 'http://api.fanyi.baidu.com/api/trans/vip/translate';
    private $appid = '20181024000223974';
    private $seckey = 'gLo0sD0eL8DBnnLcap0o';

    public function request($content, $from = 'jp', $to = 'zh')
    {
        $args = array(
            'q' => $content,
            'appid' => $this->appid,
            'salt' => rand(10000, 99999),
            'from' => $from,
            'to' => $to,
        );
        $args['sign'] = $this->buildSign($content, $args['salt']);
        if(env('app.proxy',0) !=0){
            $result = request_proxy($this->url,'POST', $args,[]);
        }else{
            $result = request_post($this->url, $args);
        }
        return $result;
    }

    private function buildSign($query, $salt)
    {
        $str = $this->appid . $query . $salt . $this->seckey;
        $ret = md5($str);
        return $ret;
    }


    public static function zh2jp($content){
        $api = new Translate();
        $result = $api->request($content,'zh','jp');
        $resArr = is_array($result)?$result:json_decode($result,true);
        if(is_null($resArr) || !isset($resArr['trans_result'])){
            return $content;
        }
        $dstList = $resArr['trans_result'];
        $searchArr = array_column($dstList,'src');
        $replaceArr = array_column($dstList,'dst');
        $dst = str_replace($searchArr,$replaceArr,$content);
        return $dst;
    }

    public static function jp2zh($content){
        $api = new Translate();
        $result = $api->request($content);
        $resArr = is_array($result)?$result:json_decode($result,true);
        if(is_null($resArr) || !isset($resArr['trans_result'])){
            return $resArr['error_msg'];
        }
        return $resArr['trans_result'];
    }
}