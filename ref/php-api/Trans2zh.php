<?php
/**
 * Created by PhpStorm.
 * Date: 2021/9/27
 * Time: 00:41
 * description:
 */

namespace app\api\controller;

use app\common\library\Translate;
use think\App;
use think\facade\Db;


class Trans2zh extends Base
{

    public function __construct(App $app)
    {
        $this->noNeedLogin = ['*'];
        parent::__construct($app);
    }

    public function jp2zh()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }

        $lastOrderInfo = Db::name('orders')
            ->where('uid',$this->uid)
            ->where('is_pay',1)
            ->order('id desc')
            ->find();
        if(!$lastOrderInfo || time() - $lastOrderInfo['create_time'] > 86400*14){
            //return $this->jerror('翻译失败');
        }

        $src = input('src', '');
        if (empty($src)) {
            return $this->jerror('src error');
        }
        $dstList = Translate::jp2zh(strip_tags($src));
        if(is_string($dstList)){
            return $this->jerror($dstList);
        }
        $searchArr = array_column($dstList,'src');
        $replaceArr = array_column($dstList,'dst');
        $dst = str_replace($searchArr,$replaceArr,$src);
        return $this->jsuccess('ok', ['dst' => $dst]);
    }

}