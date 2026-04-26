<?php
namespace app\common\library;


use think\App;
use think\facade\Config;

class BaseLogic{

    public function __construct()
    {

        //-- 同步配置
        $configModel = new \app\common\model\Configs();
        Config::set($configModel->getAllArr(), 'config');
    }
}
