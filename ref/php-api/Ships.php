<?php
namespace app\api\controller;
use app\api\controller\Base;
use app\common\model\Configs;
use think\App;
use think\facade\Db;

//运费计算相关
class Ships extends Base
{
    public function __construct(App $app)
    {
        $this->noNeedLogin = ['*'];
        parent::__construct($app);
    }

    public function datas(){
        $key = 'ship_fee_calc';
        $redis = new \Tools\StRedis();
        $json = $redis->get($key);
        if(!empty($json)){
            //return $this->jsuccess('ok',json_decode($json,true));
        }
        //价格标准
        //国家
        //支持的快递
        $pricesList = Db::name('shipment_prices')
            ->field('method_code,weight_limit,ship_amount,area')
            ->order('weight_limit desc')
            ->select()->toArray();
        $countryList = Db::name('shipment_country')
            ->select()->toArray();
        $shipList = Db::name('shipments')
            ->where('is_deleted',0)
            ->select()->toArray();
        $configArr = (new Configs())->getAllArr();
        $data = [
            'prices' => $pricesList,
            'countrys' => $countryList,
            'ships' => $shipList,
            'rate' => $configArr['SHIP_EXCHANGE_RATE'],
        ];

        $redis->set($key,json_encode($data),3600);
        return $this->jsuccess('ok',$data);
    }
}