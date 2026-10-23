# SMBJ disables its desktop-only Kerberos authenticator on Android. The app
# uses NTLM/guest authentication and no MBassador expression-language filters.
-dontwarn org.ietf.jgss.**
-dontwarn javax.el.**

# SMBJ's connection events are dispatched through MBassador annotations.
-keepattributes RuntimeVisibleAnnotations
-keepclassmembers class com.hierynomus.smbj.** {
    @net.engio.mbassy.listener.Handler <methods>;
}
