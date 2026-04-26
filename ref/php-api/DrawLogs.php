<?php
namespace app\common\model;


use think\Model;
use Tools\StRedis;

class DrawLogs extends Model
{
    protected $table = 'st_draw_logs';

    protected $autoWriteTimestamp = true;

    public function addLog($box,$boxGoods,$userInfo){
        $data = [
            'did' => $box['id'],
            'draw_price' => $box['price'],
            'uid' => $userInfo['id'],
            'type' => $boxGoods['type'],
            'prize' => $boxGoods['prize'],
            'create_time' => time()
        ];
        return $this->insert($data);
    }
}