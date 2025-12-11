#!/bin/bash
yum update -y
yum install -y iptables-services mysql

systemctl stop firewalld
systemctl disable firewalld

echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
sysctl -p

PRIMARY_INTERFACE=$(ip route | grep default | awk '{print $5}')

# 전달받은 CIDR 목록 변수
PRIVATE_CIDRS="${private_subnet_cidrs}"

iptables -F FORWARD
iptables -t nat -F
iptables -t nat -A POSTROUTING -o $PRIMARY_INTERFACE -j MASQUERADE

# Loop to handle multiple CIDRs
for cidr in $(echo $PRIVATE_CIDRS | sed "s/,/ /g"); do
    iptables -A FORWARD -s $cidr -o $PRIMARY_INTERFACE -j ACCEPT
done
iptables -A FORWARD -m state --state RELATED,ESTABLISHED -j ACCEPT

service iptables save
systemctl enable iptables
systemctl start iptables

systemctl enable amazon-ssm-agent
systemctl start amazon-ssm-agent