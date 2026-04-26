<?php
/**
 * Created by PhpStorm.
 * Date: 2020/12/3
 * Time: 22:46
 * description:
 */
namespace app\common\model;

use think\helper\Str;
use think\Model;
use Tools\StRedis;

class Configs extends Model
{
    protected $table = 'st_config';
    public function getAllArr(){
        $redis = new StRedis();
        $json = $redis->get($this->table);
        if(!empty($json)){
            return is_array($json)?$json:json_decode($json,true);
        }
        $list = $this->select()->toArray();
        $arr = [];
        foreach ($list as $item){
            $arr[$item['name']] = $item['value'];
        }
        $redis->set($this->table,json_encode($arr),86400);
        $redis->expire($this->table,86400);
        return $arr;
    }

    public static function clearCache(){
        $redis = new StRedis();
        $redis->del('st_config');
    }

    public function parseSelectExtra($extra){
        $result = [];
        $arr = explode('|',$extra);
        foreach ($arr as $item){
            $temp = explode(':',$item);
            $result[$temp[0]] = $temp[1];
        }
        return $result;
    }
}