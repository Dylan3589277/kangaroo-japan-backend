<?php
/**
 * Created by PhpStorm.
 * Date: 2020/12/8
 * Time: 21:59
 * description:
 */
use think\facade\Route;

//Route::post('obtain/token', function () {
//    return json(['code' => 333]);
//});
//
//-- 登录
Route::get('picture/:filename', 'Picture/index');
