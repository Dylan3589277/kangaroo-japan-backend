<?php
namespace app\common\library;


class Kuaidi100
{
    protected $customer = 'E3C27F6CC320051A5148A6E3CB764F7D';
    protected $key = 'KxSpZhQm3127';

    /**
     * 私有化构造方法
     */
    public function __construct()
    {
    }
    /**
     * 快递查询
     * @param $com
     * @param $num
     * @return false|mixed
     */
    public function query($com,$num){
        $param = array (
            'com' => $com,             // 快递公司编码
            'num' => $num,     // 快递单号
            'phone' => '',                // 手机号
            'from' => '',                 // 出发地城市
            'to' => '',                   // 目的地城市
            'resultv2' => '1',            // 开启行政区域解析
            'show' => '0',                // 返回格式：0：json格式（默认），1：xml，2：html，3：text
            'order' => 'desc'             // 返回结果排序:desc降序（默认）,asc 升序
        );

        //请求参数
        $post_data = [];
        $post_data['customer'] = $this->customer;
        $post_data['param'] = json_encode($param, JSON_UNESCAPED_UNICODE);
        $sign = md5($post_data['param'].$this->key.$post_data['customer']);
        $post_data['sign'] = strtoupper($sign);
        $url = 'https://poll.kuaidi100.com/poll/query.do';    // 实时查询请求地址
        $response = request_post($url,$post_data);
        if(empty($response)){
            return false;
        }
        return json_decode($response,true);
    }

}