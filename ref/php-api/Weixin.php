<?php
namespace app\api\controller;

use app\common\library\WechatMnpApi;
use app\common\logic\MyWechatLogic;
use think\App;

class Weixin extends Base{


    public function __construct(App $app)
    {
        $this->noNeedLogin = ['*'];
        parent::__construct($app);
    }

    public function mnp(){
        (new MyWechatLogic(true))->run();
    }

    public function token(){
        $pwd = input('pwd','');
        if($pwd != 'standopen'){
            exit('fail');
        }
        $jssdk = new WechatMnpApi();
        echo $jssdk->getToken();
        exit();
    }

    public function menu(){
        $jssdk = new WechatMnpApi();
        $menuArr = [
            'button' => [
                [
                    'name' => '煤炉下单',
                    'type' => 'miniprogram',
                    'appid' => 'wx208645d960d3f104',
                    'pagepath' => 'pages/daishujun/category/category',
                    'url' => 'https://babujiu.com',
                    'sub_button' => []
                ],
                [
                    'name' => '雅虎下单',
                    'type' => 'miniprogram',
                    'appid' => 'wx84d6de39d3136d49',
                    'pagepath' => 'pages/daishujun/category/yahoo',
                    'url' => 'https://babujiu.com',
                    'sub_button' => []
                ],
                [
                    'name' => '咨询客服',
                    'type' => 'view',
                    'url' => 'https://kf.kangaroo-japan.net/code/xcx/8252b02b9d3316d5208582bc9dd052118/1',
                    'sub_button' => []
                ]
            ]
        ];
        return $jssdk->createMenu($menuArr);
    }
}