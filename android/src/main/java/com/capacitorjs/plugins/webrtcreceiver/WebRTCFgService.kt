package com.capacitorjs.plugins.capwebrtc

import android.app.*
import android.content.Intent
import android.os.Build
import android.os.IBinder

class WebRTCFgService : Service() {

  override fun onCreate() {
    super.onCreate()
    val channelId = "webrtc_receiver_call"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val chan = NotificationChannel(channelId, "WebRTC Receiver", NotificationManager.IMPORTANCE_LOW)
      val nm = getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(chan)
    }

    val notif = Notification.Builder(this, channelId)
      .setContentTitle("Call in progress")
      .setContentText("Receiving audio")
      .setSmallIcon(android.R.drawable.stat_sys_phone_call)
      .build()

    startForeground(1001, notif)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY
  override fun onBind(intent: Intent?): IBinder? = null
}

