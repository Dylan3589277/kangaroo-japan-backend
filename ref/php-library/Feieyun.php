<?php
namespace app\common\library;

use app\common\model\Configs;
use app\common\model\OrderModel;
use think\facade\Db;
use Tools\StRedis;

class Feieyun
{

    public function __construct()
    {
    }

    public  function printLabel($orderList){
        $config = (new Configs())->getAllArr();
        $contents = [];

        foreach ($orderList as $orderInfo){
            $labels = $config['PRINTER_FEIYE_LABEL'];
            foreach ($orderInfo as $key => $value){
                $labels = str_replace(sprintf("{%s}",$key),$value,$labels);
            }
            $contents[] = [
                'content' => $labels,
                'times' => 1
            ];
        }


        $form = [
            'apiname' => 'Open_printLabelMsg',
            'user' => $config['PRINTER_FEIYE_USER'],
            'stime' => time(),
            'sn' => $config['PRINTER_SN'],
            'contents' => json_encode($contents),
            'times' => 1
        ];
        $form['sig'] = sha1($form['user'].$config['PRINTER_FEIYE_UKEY'].$form['stime']);
        $url = 'https://api.feieyun.cn/Api/Open/';
        $result = request_post($url,$form,false,30,false,1);
        $resArr = json_decode($result,true);
        if(!isset($resArr['ret'])){
            return [1,'打印失败'];
        }
        if(intval($resArr['ret']) != 0 ){
            return [1,$resArr['msg']];
        }
        return [0,'打印成功'];
    }
}